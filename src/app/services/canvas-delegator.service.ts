import { BehaviorSubject, Subscription } from 'rxjs';
import { Resolver } from '~~/utils/promise.util';

import { DefaultContainer } from '../canvas/default.container';
import { CanvasDelegator } from '../interfaces/canvas-delegator.interface';
import { ResourceProvider } from '../providers/resource.provider';
import { resolve } from 'path';

export class CanvasDelegatorService {
  private static instance: CanvasDelegatorService;
  private resources = ResourceProvider.getInstance();
  private delegators: CanvasDelegator[] = [];
  private containerSubscriptions: {
    [name: string]: Subscription,
  } = {};

  private containerSubjects: {
    [name: string]: BehaviorSubject<DefaultContainer[]>,
  } = {};

  private containerResolvers: {
    [name: string]: Resolver<BehaviorSubject<DefaultContainer[]>>;
  } = {};

  public static getInstance(): CanvasDelegatorService {
    if ( ! this.instance) {
      return this.instance = new CanvasDelegatorService();
    }

    return this.instance;
  }

  public addContainer(
    name: string,
    ...containers: DefaultContainer[]
  ) {
    let resolver = this.containerResolvers[name];

    if ( ! resolver) {
      this.containerResolvers[name] = resolver = new Resolver();
    }

    resolver.promise.then((subject) => {
      this.resources.loaded.then(() => {
        subject.next(subject.value.concat(containers));
      });
    });
  }

  public removeContainer(
    name: string,
    container: DefaultContainer,
  ) {
    const subject = this.containerSubjects[name];
    const containers = subject.value;
    const index = containers.indexOf(container);

    if (index > -1) {
      subject.next(containers.splice(index, 1));
    }
  }

  public register(delegator: CanvasDelegator) {
    if (this.containerSubjects.hasOwnProperty(delegator.name)) {
      throw new Error(
        `Delegator with name ${delegator.name} does already exists`,
      );
    }

    const subject = new BehaviorSubject<DefaultContainer[]>([]);

    this.delegators.push(delegator);

    this.containerSubjects[delegator.name] = subject;
    this.containerSubscriptions[delegator.name] = subject.subscribe(
      (containers) => delegator.containersUpdated(containers),
    );

    if (this.containerResolvers.hasOwnProperty(delegator.name)) {
      this.containerResolvers[delegator.name].resolve(subject);
    }
  }

  public deregister(retainer: CanvasDelegator) {
    if (this.containerSubjects.hasOwnProperty(retainer.name)) {
      this.containerSubscriptions[retainer.name].unsubscribe();

      delete this.containerSubscriptions[retainer.name];
      delete this.containerSubjects[retainer.name];
    }

    const index = this.delegators.indexOf(retainer);

    if (index > -1) {
      this.delegators = this.delegators.splice(index, 1);
    }
  }
}
