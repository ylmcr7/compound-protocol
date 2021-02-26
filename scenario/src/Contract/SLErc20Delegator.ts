import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { SLTokenMethods } from './SLToken';
import { encodedNumber } from '../Encoding';

interface SLErc20DelegatorMethods extends SLTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface SLErc20DelegatorScenarioMethods extends SLErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface SLErc20Delegator extends Contract {
  methods: SLErc20DelegatorMethods;
  name: string;
}

export interface SLErc20DelegatorScenario extends Contract {
  methods: SLErc20DelegatorMethods;
  name: string;
}
