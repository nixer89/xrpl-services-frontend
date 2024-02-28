import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import * as flagsutil from '../../utils/flagutils';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged, AccountObjectsChanged } from 'src/app/utils/types';
import * as utils from 'src/app/utils/utils';

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
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpsignerquorum') inpsignerquorum;
  signerQuorumInput: string;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  originalAccountInfo:any;
  signerListObject:any;

  signerList:SignerEntry[] = [];
  //[{SignerEntry: {Account: 'rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF', SignerWeight: 1}, valid: true}, {SignerEntry: {Account: 'rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL', SignerWeight:1}, valid: true}];

  private transactionSuccessfullSubscription: Subscription;

  validSignerList = false;
  validSignerQuorum:SignerListQuorumValidation = { valid:true, message: 'A multi-signature from the list below is valid only if the sum weights of the signatures provided is greater than or equal to this value.'}

  overallSignerWeights:number = 0;

  changesDetected:boolean = false;

  private payload:XummTypes.XummPostPayloadBodyJson = {
    txjson: {
      TransactionType: "SignerListSet"
    }
  }

  ngOnInit() {
    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received: " + JSON.stringify(accountObjects))
      this.clearInputs();

      if(accountObjects && accountObjects.objects) {
        this.signerListObject = accountObjects.objects.filter(object => object.LedgerEntryType === "SignerList")[0];

        //console.log("signerListObject: " + JSON.stringify(this.signerListObject));

        if(this.signerListObject) {
          this.signerList = this.signerListObject.SignerEntries;
          this.signerList.forEach(signerEntry => {
            signerEntry.SignerEntry.SignerWeight = signerEntry.SignerEntry.SignerWeight+"";
            signerEntry.valid = true;
          });
          this.signerQuorumInput = this.signerListObject.SignerQuorum+"";
          this.checkChanges();
        }
      } else {
        this.signerListObject = null;
        this.signerList = [];
        this.checkChanges();
      }
    });

    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData))
      this.originalAccountInfo = accountData.info;
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
    return signer && signer.SignerEntry && this.isValidXRPAddress(signer.SignerEntry.Account) && !this.isDuplicateAccount(signer.SignerEntry.Account) && !this.isSameAsLoggedIn(signer.SignerEntry.Account) && this.isValidWeight(signer.SignerEntry.SignerWeight) ;
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

  isSameAsLoggedIn(address: string): boolean {
    return this.originalAccountInfo && this.originalAccountInfo.Account === address.trim();
  }

  isValidInteger(weight: string): boolean {
    return weight && weight.trim().length > 0 && !weight.includes(',') && !weight.includes('.') && weight.split('')[0] != "0" && Number.isInteger(Number.parseInt(weight));
  }

  isValidXRPAddress(account: string) {
    return utils.isValidXRPAddress(account);
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
    return this.originalAccountInfo && (!flagsutil.isMasterKeyDisabled(this.originalAccountInfo.Flags) || this.originalAccountInfo.RegularKey);
  }

  sendPayloadToXumm() {

    this.payload.custom_meta = {};

    //console.log("sending to xumm");
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
    this.payload.custom_meta.instruction = "- Number of signers: " + signerListToSend.length;
    
    this.payload.txjson.SignerQuorum = this.signerQuorumInput
    this.payload.custom_meta.instruction += "\n- Quorum for valid MultiSignature: " + this.signerQuorumInput;

    this.payload.custom_meta.instruction += "\n- Overall signer weight: " + this.overallSignerWeights;

    if(signerListToSend && signerListToSend.length > 0 && this.validSignerList)
      this.payload.txjson.SignerEntries = signerListToSend;

    this.payload.custom_meta.instruction += "\n\n- Please check the Signer List in the XUMM App!";

    this.onPayload.emit(this.payload);
  }

  clearInputs() {
    this.signerListObject = null;
    this.signerQuorumInput = null;
    this.signerList = [];
    this.validSignerList = false;

    this.payload = {
      txjson: {
        TransactionType: "SignerListSet"
      }
    }
  }

  deleteSignerList() {
    this.onPayload.emit({
      txjson: {
        TransactionType: "SignerListSet",
        SignerQuorum: 0
      },
      custom_meta: {
        instruction: 'Delete Signer List.'
      }
    });
  }
}
