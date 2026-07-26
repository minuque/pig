import type { HealthState } from "../types.js";
export class Health {
  private state: HealthState = "starting";
  set(state: HealthState) {
    this.state = state;
  }
  get() {
    return this.state;
  }
}
