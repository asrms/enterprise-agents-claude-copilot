---
name: pytorch-training
description: "Efficient and correct PyTorch training: Dataset and DataLoader design, device handling, mixed precision with torch.autocast, torch.compile, gradient accumulation and clipping, distributed training with DDP or FSDP launched by torchrun, checkpointing and resumption, evaluation mode, reproducibility, profiling, and safe model serialization. Use it when writing or reviewing PyTorch training code."
---

# Skill: PyTorch Training

## Implementation Rules:
- **[PATTERN]** Structure training code into a `Dataset` (lazy, index-based loading and transforms), a model `nn.Module`, and a training loop or a framework (PyTorch Lightning, Hugging Face Accelerate/Trainer) that separates configuration from code; configuration comes from typed config files, not hard-coded constants.
- **[PERFORMANCE]** Feed the GPU: `DataLoader` with `num_workers > 0`, `pin_memory=True`, `persistent_workers=True`, and `prefetch_factor` tuned; data preprocessing done offline or in workers, not in the training loop; check GPU utilization before optimizing the model.
- **[PERFORMANCE]** Use mixed precision with `torch.autocast(device_type="cuda", dtype=torch.bfloat16)` on hardware that supports bfloat16 (or float16 with `torch.amp.GradScaler`), and try `torch.compile(model)` after correctness is established, measuring speedup.
- **[MANDATORY]** Put the model in `model.train()` for training and `model.eval()` plus `torch.inference_mode()` for validation and inference, so dropout and batch norm behave correctly and no gradients are tracked.
- **[PATTERN]** Stabilize optimization: learning-rate schedules with warmup, gradient clipping (`torch.nn.utils.clip_grad_norm_`), gradient accumulation for large effective batch sizes, `optimizer.zero_grad(set_to_none=True)`, and weight decay excluded from bias and normalization parameters.
- **[PATTERN]** Scale out with `DistributedDataParallel` launched by `torchrun` for models that fit on one GPU, and FSDP (fully sharded data parallel) for larger models; use `DistributedSampler` with `set_epoch`, and log and checkpoint only from rank 0.
- **[MANDATORY]** Checkpoint regularly with model, optimizer, scheduler, scaler, epoch/step, and RNG states so training can resume after preemption; save weights for distribution in `safetensors` format and load untrusted checkpoints only with `torch.load(..., weights_only=True)`.
- **[FORBIDDEN]** Calling `.item()` or moving tensors to CPU every step in the hot loop (forces synchronization), accumulating tensors with graph history in Python lists (memory leak; use `.detach()`), evaluating without `model.eval()`, and loading pickled checkpoints from unknown sources with `weights_only=False`.
- **[PATTERN]** Reproducibility: set seeds for Python, NumPy, and torch, seed DataLoader workers with a generator, log library and CUDA versions, and enable `torch.use_deterministic_algorithms(True)` when bitwise reproducibility is required.
- **[PERFORMANCE]** Profile before optimizing with `torch.profiler` (CPU/GPU activity, memory) and track throughput (samples per second) and GPU memory; use activation checkpointing only when memory-bound.
- **[TESTING]** Test shapes and invariants of the model with tiny inputs, verify that a single batch can be overfit (loss approaches zero) as a sanity check, and run a short training smoke test in CI on CPU.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
