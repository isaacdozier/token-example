import { authority, Base58, chain, Protobuf, System } from "koinos-as-sdk";
import { token } from "./proto/token";
import { State } from "./State";

export class Token {
  _name: string = "Token Demo B";
  _symbol: string = "TKNA";
  _decimals: u32 = 8;

  _contractId: Uint8Array;
  _state: State;

  constructor() {
    this._contractId = System.getContractId();
    this._state = new State(this._contractId);
  }

  name(args: token.name_arguments): token.name_result {
    return new token.name_result(this._name);
  }

  symbol(args: token.symbol_arguments): token.symbol_result {
    return new token.symbol_result(this._symbol);
  }

  decimals(args: token.decimals_arguments): token.decimals_result {
    return new token.decimals_result(this._decimals);
  }

  total_supply(args: token.total_supply_arguments): token.total_supply_result {
    const supply = this._state.GetSupply();

    const res = new token.total_supply_result();
    res.value = supply.value;

    return res;
  }

  balance_of(args: token.balance_of_arguments): token.balance_of_result {
    const owner = args.owner as Uint8Array;

    const balanceObj = this._state.GetBalance(owner);

    const res = new token.balance_of_result();
    res.value = balanceObj.value;

    return res;
  }

  transfer(args: token.transfer_arguments): token.transfer_result {
    const from = args.from as Uint8Array;
    const to = args.to as Uint8Array;
    const value = args.value;

    const fromB58 = Base58.encode(from);
    const toB58 = Base58.encode(to);

    const res = new token.transfer_result();

    if (fromB58 == toB58) {
      System.log('Cannot transfer to self');

      return res;
    }

    const _caller = System.getCaller();
    if(_caller.caller) {
      if(Base58.encode(_caller.caller as Uint8Array) != fromB58) {
        System.requireAuthority(authority.authorization_type.contract_call, from);
      }
    }

    const fromBalance = this._state.GetBalance(from);

    if (fromBalance.value < value) {
      System.log("'from' has insufficient balance");

      return res;
    }

    const toBalance = this._state.GetBalance(to);

    fromBalance.value -= value;
    toBalance.value += value;

    this._state.SaveBalance(from, fromBalance);
    this._state.SaveBalance(to, toBalance);

    const transferEvent = new token.transfer_event(from, to, value);
    const impacted = [to, from];

    System.event('token.transfer', Protobuf.encode(transferEvent, token.transfer_event.encode), impacted);

    res.value = true;

    return res;
  }

  mint(args: token.mint_arguments): token.mint_result {
    const to = args.to as Uint8Array;
    const value = args.value;

    const res = new token.mint_result(false);

    System.requireAuthority(authority.authorization_type.contract_call, this._contractId);

    const supply = this._state.GetSupply();

    const newSupply = supply.value + value;

    if (newSupply < supply.value) {
      System.log('Mint would overflow supply');

      return res;
    }
    
    const toBalance = this._state.GetBalance(to);
    toBalance.value += value;

    supply.value = newSupply;

    this._state.SaveSupply(supply);
    this._state.SaveBalance(to, toBalance);

    const mintEvent = new token.mint_event(to, value);
    const impacted = [to];

    System.event('token.mint', Protobuf.encode(mintEvent, token.mint_event.encode), impacted);

    res.value = true;

    return res;
  }
}
