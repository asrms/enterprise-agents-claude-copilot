# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Slow, leaky, and incorrect training loop
```python
loader = DataLoader(dataset, batch_size=32, shuffle=True)          # single-process loading
losses = []
for epoch in range(10):
    for x, y in loader:
        x, y = x.cuda(), y.cuda()
        loss = criterion(model(x), y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        losses.append(loss)                                           # keeps the autograd graph alive
        print(loss.item())                                            # GPU sync every step
    acc = evaluate(model, val_loader)                                 # model still in train mode, gradients tracked
torch.save(model, "model.pt")                                         # pickles the whole module
```
**Why it's wrong:**
- Data loading starves the GPU; storing loss tensors leaks memory; per-step `.item()` forces synchronization.
- Evaluation runs with dropout active and autograd enabled, and the checkpoint cannot resume training.

## Best Practice (How to do it right)

### 1. Mixed precision, clipping, proper evaluation, and resumable checkpoints
```python
def train(cfg: TrainConfig) -> None:
    torch.manual_seed(cfg.seed)
    device = torch.device("cuda")
    g = torch.Generator().manual_seed(cfg.seed)

    train_loader = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True, generator=g,
                              num_workers=8, pin_memory=True, persistent_workers=True)
    val_loader = DataLoader(val_ds, batch_size=cfg.batch_size * 2, num_workers=4, pin_memory=True)

    model = build_model(cfg).to(device)
    model = torch.compile(model)
    optimizer = torch.optim.AdamW(param_groups(model, weight_decay=0.05), lr=cfg.lr)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=cfg.lr, total_steps=cfg.epochs * len(train_loader))
    start_epoch = load_checkpoint_if_any(cfg.ckpt_dir, model, optimizer, scheduler)

    for epoch in range(start_epoch, cfg.epochs):
        model.train()
        running = torch.zeros((), device=device)
        for x, y in train_loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
                loss = criterion(model(x), y)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()
            running += loss.detach()

        model.eval()
        with torch.inference_mode():
            val_metrics = evaluate(model, val_loader, device)
        mlflow.log_metrics({"train_loss": (running / len(train_loader)).item(), **val_metrics}, step=epoch)

        torch.save({
            "model": model.state_dict(), "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(), "epoch": epoch + 1,
            "rng": torch.get_rng_state(), "cuda_rng": torch.cuda.get_rng_state_all(),
        }, f"{cfg.ckpt_dir}/last.pt")

    save_file(model.state_dict(), f"{cfg.out_dir}/model.safetensors")   # safetensors for distribution
```
```bash
# multi-GPU with DDP (the script wraps the model in DistributedDataParallel and uses DistributedSampler)
torchrun --nproc_per_node=8 train.py --config configs/churn_transformer.yaml
```
**Why it's right:**
- Loading runs in parallel workers, bfloat16 autocast and `torch.compile` speed up training, and gradients are clipped.
- Losses are accumulated on the device without graph history and synchronized once per epoch.
- Evaluation uses eval mode with inference mode, checkpoints capture everything needed to resume, and weights ship as safetensors.
