export type Disposer = () => void;

/** Owns app resources; cleanup runs once in reverse installation order. */
export class ApplicationLifetime {
  private resources: Disposer[] = [];
  private disposed = false;

  add(dispose: Disposer): void {
    let active = true;
    const once = () => { if (active) { active = false; dispose(); } };
    if (this.disposed) once();
    else this.resources.push(once);
  }

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const dispose of this.resources.splice(0).reverse()) {
      try { dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Application cleanup failed');
  };
}
