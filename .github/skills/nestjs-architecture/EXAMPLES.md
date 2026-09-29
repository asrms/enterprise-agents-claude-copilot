# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Fat controller, raw body, entity returned
```typescript
@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: any) {
    if (!body.items.length) throw new Error('empty');                    // generic 500
    const total = body.items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    return this.prisma.order.create({ data: { ...body, total, user: { connect: { id: user!.id } } } });
  }
}
```
**Why it's wrong:**
- `any` body with no validation; the client controls `userId` and prices (mass assignment and tampering).
- Business logic and persistence live in the controller, so they cannot be reused or unit-tested.
- Errors become 500 responses, and the persistence entity is returned as the API response.

## Best Practice (How to do it right)

### 1. Validated DTO, thin controller, service behind a port
```typescript
export class CreateOrderItemDto {
  @IsString() @Length(1, 64) sku!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class CreateOrderDto {
  @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1) @ArrayMaxSize(50)
  items!: CreateOrderItemDto[];
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly placeOrder: PlaceOrderService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser): Promise<OrderResponseDto> {
    const order = await this.placeOrder.execute({ customerId: user.id, items: dto.items });
    return OrderResponseDto.from(order);
  }
}

@Injectable()
export class PlaceOrderService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PRICE_CATALOG) private readonly prices: PriceCatalog,
  ) {}

  async execute(cmd: PlaceOrderCommand): Promise<Order> {
    const priced = await this.prices.priceItems(cmd.items);   // prices come from the server, not the client
    const order = Order.place(cmd.customerId, priced);        // domain rules and invariants
    await this.orders.save(order);
    return order;
  }
}
```
```typescript
// main.ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 1_048_576 }));
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new ProblemDetailsFilter());
app.enableShutdownHooks();
```
**Why it's right:**
- Input is validated and bounded at the edge; the customer id comes from the authenticated principal.
- The controller only maps HTTP; the use case depends on ports and can be tested without HTTP or a database.
- A response DTO controls exactly what is exposed, and a global filter produces consistent problem details.
