import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { Subscription, Observable } from 'rxjs';
import * as flagsutil from '../../utils/flagutils';
import { XummPostPayloadBodyJson } from 'xumm-api';

interface SignerListQuorumValidation {
  valid: boolean,
  message: string
}

interface SignerEntry {
  SignerEntry: {
    Account: string,
    SignerWeight: string
  },
  valid?: boolean
}

@Component({
  selector: 'signerlistset',
  templateUrl: './signerlistset.html',
  styleUrls: ['./signerlistset.css']
})
export class SignerListSetComponent implements OnInit, OnDestroy {

  @Input()
  accountObjectsChanged: Observable<any>;

  @Input()
  accountInfoChanged: Observable<any>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<any> = new EventEmitter();

  @ViewChild('inpsignerquorum', {static: false}) inpsignerquorum;
  signerQuorumInput: string;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  originalAccountObjects:any;

  signerList:SignerEntry[] = [];
  //[{SignerEntry: {Account: 'rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF', SignerWeight: 1}, valid: true}, {SignerEntry: {Account: 'rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL', SignerWeight:1}, valid: true}];

  private transactionSuccessfullSubscription: Subscription;

  validSignerList = false;
  validSignerQuorum:SignerListQuorumValidation = { valid:true, message: 'A multi-signature from the list below is valid only if the sum weights of the signatures provided is greater than or equal to this value.'}

  overallSignerWeights:number = 0;

  changesDetected:boolean = false;

  private payload:XummPostPayloadBodyJson = {
    options: {
      expire: 5
    },
    txjson: {
      TransactionType: "SignerListSet"
    }
  }

  ngOnInit() {
    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      this.originalAccountObjects = accountObjects;
      if(this.originalAccountObjects && this.originalAccountObjects[0] && this.originalAccountObjects[0].LedgerEntryType==="SignerList") {
        this.signerList = this.originalAccountObjects[0].SignerEntries;
        this.signerList.forEach(signerEntry => {
          signerEntry.SignerEntry.SignerWeight = signerEntry.SignerEntry.SignerWeight+"";
          signerEntry.valid = true;
        });
        this.signerQuorumInput = this.originalAccountObjects[0].SignerQuorum+"";
        this.checkChanges();
      }
    });

    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData;
    });
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
    
    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();

    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();
  }

  checkChanges() {

    //console.log("check changes");
    //console.log("signerList: " + JSON.stringify(this.signerList));
    //console.log("signerQuorumInput: " + this.signerQuorumInput);

    let tmpOverallWeights:number = 0;
    let allSignersEntriesValid = true;
    this.signerList.forEach( signer => {
      if(allSignersEntriesValid)
        allSignersEntriesValid = signer.valid;

      if(allSignersEntriesValid)
        tmpOverallWeights+= Number.parseInt(signer.SignerEntry.SignerWeight);
    });

    this.overallSignerWeights = tmpOverallWeights;
    this.validSignerQuorum = this.checkQuorum(this.overallSignerWeights);
    //console.log(JSON.stringify(this.validSignerQuorum));
    
    this.validSignerList = allSignersEntriesValid && this.validSignerQuorum.valid;
  }

  checkQuorum(overallSignerWeights: number): SignerListQuorumValidation {
    let tmpValid = true;
    let tmpMessage = '';

    if(tmpValid && this.signerQuorumInput && !this.isValidInteger(this.signerQuorumInput)) {
      tmpValid = false;
      tmpMessage = "Please provide an integer value"
    }

    if(tmpValid && parseInt(this.signerQuorumInput) < 1) {
      tmpValid = false;
      tmpMessage = "Please provide a value greater than 0";
    }

    if(tmpValid && parseInt(this.signerQuorumInput) > 4294967295) {
      tmpValid = false;
      tmpMessage = "Please provide a value smaller than 4294967296";
    }

    if(tmpValid && this.signerQuorumInput && this.signerQuorumInput && overallSignerWeights < parseInt(this.signerQuorumInput)) {
      tmpValid = false;
      tmpMessage = "Your signer list does not have enough weight to meet the quorum"
    }

    if(tmpValid && (!this.signerQuorumInput || this.signerQuorumInput.trim().length == 0) && this.signerList.length > 0) {
      tmpValid = false;
      tmpMessage = "Please provide a signer quorum which needs to be matched to be able to submit a multi sign transaction.";
    }

    if(tmpValid)
      tmpMessage = 'A multi-signature from the list below is valid only if the sum weights of the signatures provided is greater than or equal to this value.';

    return {valid: tmpValid, message: tmpMessage};
  }

  checkSignerChanges(signer:SignerEntry) {
    //console.log("checkSignerChanges: " + JSON.stringify(signer));
    //console.log("destinationInput: " + this.destinationInput);
    //console.log("signer.SignerEntry.SignerWeight: " + signer.SignerEntry.SignerWeight);
    
    signer.valid = this.isValidSigner(signer)

    this.checkChanges();
    //console.log("isValidEscrowCancel: " + this.isValidEscrowCancel);
  }

  isValidSigner(signer: SignerEntry) {
    return signer && signer.SignerEntry && this.isValidXRPAddress(signer.SignerEntry.Account) && this.isValidWeight(signer.SignerEntry.SignerWeight);
  }

  isValidXRPAddress(address: string): boolean {
    if(!address || address.trim().length <= 0)
      return false;
    try {
      //console.log("encoding address: " + address);
      let xAddress = Encode({account: address});
      //console.log("xAddress: " + xAddress);
      return xAddress && xAddress.length > 0;
    } catch(err) {
      //no valid address
      //console.log("err encoding " + err);
      return false;
    }
  }

  isValidWeight(weight: string) {
    if(this.isValidInteger(weight))
      return Number.parseInt(weight) >= 1 && Number.parseInt(weight) <= 65535;
    else
      false;
  }

  isDuplicateAccount(address: string): boolean {
    return this.signerList.filter(signer => signer.SignerEntry.Account === address).length > 1;
  }

  isValidInteger(weight: string): boolean {
    return weight && weight.trim().length > 0 && !weight.includes(',') && !weight.includes('.') && weight.split('')[0] != "0" && Number.isInteger(Number.parseInt(weight));
  }

  addSigner() {
    this.signerList.push({SignerEntry: { Account: null, SignerWeight: null}, valid: false});
    this.checkChanges();
  }

  removeSigner(index:number) {
    //console.log("index: " + index);
    //console.log("signer list: " + JSON.stringify(this.signerList));
    this.signerList.splice(index,1);
    //console.log("signer list: " + JSON.stringify(this.signerList));
    this.checkChanges();
  }

  hasAlternativeSigningMethod() {
    return this.originalAccountInfo && this.originalAccountObjects && (!flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags) || this.originalAccountInfo.RegularKey);
  }

  sendPayloadToXumm() {
    console.log("sending to xumm");
    let signerListToSend:any[] = JSON.parse(JSON.stringify(this.signerList))
    //console.log("signerListToSend: " + JSON.stringify(signerListToSend));
    //console.log("this.signerList: " + JSON.stringify(this.signerList));
    
    //console.log("copied");
    signerListToSend.forEach(signer => {
      signer.SignerEntry.SignerWeight = parseInt(signer.SignerEntry.SignerWeight);
      delete signer.valid;
    });

    //console.log("signerListToSend: " + JSON.stringify(signerListToSend));
    //console.log("this.signerList: " + JSON.stringify(this.signerList));

    //console.log("into integer");

    if(this.signerQuorumInput && this.signerQuorumInput)
      this.payload.txjson.SignerQuorum = this.signerQuorumInput

    if(signerListToSend && signerListToSend.length > 0 && this.validSignerList)
      this.payload.txjson.SignerEntries = signerListToSend;

    this.onPayload.emit(this.payload);
  }

  clearInputs() {
    this.originalAccountObjects = null;
    this.signerQuorumInput = null;
    this.signerList = [];
    this.validSignerList = false;

    this.payload = {
      options: {
        expire: 5
      },
      txjson: {
        TransactionType: "SignerListSet"
      }
    }
  }

  deleteSignerList() {
    this.onPayload.emit({
      options: {
        expire: 5
      },
      txjson: {
        TransactionType: "SignerListSet",
        SignerQuorum: 0
      }
    });
  }
}
