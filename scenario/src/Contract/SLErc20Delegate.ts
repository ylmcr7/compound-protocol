import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { SLTokenMethods, SLTokenScenarioMethods } from './SLToken';

interface SLErc20DelegateMethods extends SLTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface SLErc20DelegateScenarioMethods extends SLTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface SLErc20Delegate extends Contract {
  methods: SLErc20DelegateMethods;
  name: string;
}

export interface SLErc20DelegateScenario extends Contract {
  methods: SLErc20DelegateScenarioMethods;
  name: string;
}
