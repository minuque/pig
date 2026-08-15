/** 过阻尼弹簧：0→1 表情过渡，中途改目标时从当前值再出发。 */
export class UnitSpring {
  value = 1;
  velocity = 0;

  constructor(
    private readonly frequency = 7,
    private readonly damping = 0.95,
  ) {}

  start(): void {
    this.value = 0;
    this.velocity = 0;
  }

  get settled(): boolean {
    return this.value >= 0.999 && Math.abs(this.velocity) < 0.01;
  }

  step(dt: number): number {
    if (this.settled) {
      this.value = 1;
      this.velocity = 0;
      return 1;
    }
    const omega = this.frequency * Math.PI * 2;
    const accel = (1 - this.value) * omega * omega - this.velocity * 2 * this.damping * omega;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    if (this.value > 1 && this.velocity > 0) {
      this.value = 1;
      this.velocity = 0;
    }
    return this.value;
  }
}
