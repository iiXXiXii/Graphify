/**
 * Factory function type definition
 */
export type Factory<T> = (...args: any[]) => T;

/**
 * Service registration options
 */
export interface ServiceOptions {
  singleton?: boolean;
  alias?: string | string[];
  lazy?: boolean;
}

/**
 * Simple dependency injection container
 */
export class Container {
  private services: Map<string, any> = new Map();
  private factories: Map<string, Factory<any>> = new Map();
  private singletons: Set<string> = new Set();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a service or value in the container
   * @param name Service name/identifier
   * @param service Service instance or factory function
   * @param options Registration options
   */
  register<T>(name: string, service: T | Factory<T>, options: ServiceOptions = {}): void {
    const { singleton = false, alias, lazy = false } = options;

    // Handle aliases
    if (alias) {
      const aliases = Array.isArray(alias) ? alias : [alias];
      for (const a of aliases) {
        this.aliases.set(a, name);
      }
    }

    // Handle service registration
    if (typeof service === 'function' && !Object.getOwnPropertyDescriptor(service, 'prototype')) {
      // It's a factory function
      this.factories.set(name, service as Factory<T>);

      if (singleton) {
        this.singletons.add(name);

        if (!lazy) {
          // Eagerly instantiate the singleton
          this.services.set(name, (service as Factory<T>)());
        }
      }
    } else {
      // It's a concrete value/instance
      this.services.set(name, service);
    }
  }

  /**
   * Get a service from the container
   * @param name Service name/identifier
   * @returns The requested service
   * @throws Error if the service doesn't exist
   */
  get<T>(name: string): T {
    // Check for aliases first
    const realName = this.aliases.get(name) || name;

    // Check if we already have an instance
    if (this.services.has(realName)) {
      return this.services.get(realName) as T;
    }

    // Try to create the service from a factory
    if (this.factories.has(realName)) {
      const factory = this.factories.get(realName)!;
      const instance = factory();

      // Store the instance if it's a singleton
      if (this.singletons.has(realName)) {
        this.services.set(realName, instance);
      }

      return instance as T;
    }

    throw new Error(`Service ${name} is not registered in the container`);
  }

  /**
   * Check if a service is registered
   * @param name Service name/identifier
   * @returns Whether the service is registered
   */
  has(name: string): boolean {
    const realName = this.aliases.get(name) || name;
    return this.services.has(realName) || this.factories.has(realName);
  }

  /**
   * Remove a service from the container
   * @param name Service name/identifier
   */
  remove(name: string): void {
    const realName = this.aliases.get(name) || name;
    this.services.delete(realName);
    this.factories.delete(realName);
    this.singletons.delete(realName);

    // Remove any aliases pointing to this service
    for (const [alias, target] of this.aliases.entries()) {
      if (target === realName) {
        this.aliases.delete(alias);
      }
    }
  }

  /**
   * Create a new container with the same services
   * @returns A new container with the same registrations
   */
  clone(): Container {
    const newContainer = new Container();

    // Copy services
    for (const [name, service] of this.services.entries()) {
      newContainer.services.set(name, service);
    }

    // Copy factories
    for (const [name, factory] of this.factories.entries()) {
      newContainer.factories.set(name, factory);
    }

    // Copy singletons set
    for (const name of this.singletons) {
      newContainer.singletons.add(name);
    }

    // Copy aliases
    for (const [alias, target] of this.aliases.entries()) {
      newContainer.aliases.set(alias, target);
    }

    return newContainer;
  }

  /**
   * Create a child container that inherits from this one
   * @returns A new child container
   */
  createChildContainer(): Container {
    const childContainer = new Container();
    const parentContainer = this;

    // Create a proxy container that checks the parent if a service is not found
    const proxyContainer = new Proxy(childContainer, {
      get(target: Container, prop: string | symbol) {
        if (prop === 'get') {
          return function<T>(name: string): T {
            if (childContainer.has(name)) {
              return childContainer.get<T>(name);
            }
            return parentContainer.get<T>(name);
          };
        }

        if (prop === 'has') {
          return function(name: string): boolean {
            return childContainer.has(name) || parentContainer.has(name);
          };
        }

        return (target as any)[prop];
      }
    });

    return proxyContainer;
  }
}
