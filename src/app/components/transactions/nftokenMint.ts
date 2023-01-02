import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, AccountObjectsChanged, XrplAccountChanged } from 'src/app/utils/types';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'nftokenMint',
  templateUrl: './nftokenMint.html'
})
export class NFTokenMintComponent implements OnInit, OnDestroy {

  private NFTOKEN_MINT_FLAG_BURNABLE:number = 1;
  private NFTOKEN_MINT_FLAG_ONLY_XRP:number = 2;
  private NFTOKEN_MINT_FLAG_TRANSFERABLE:number = 8;

  constructor(private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  accountObjectsChanged: Observable<AccountObjectsChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;
  
  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inptaxon') inptaxon;
  taxonInput: string;

  @ViewChild('inptransferfee') inptransferfee;
  transferFeeInput: any;

  @ViewChild('inpuri') inpuri;
  uriInput: string;

  @ViewChild('inpissuer') inpissuer;
  issuerInput: string;

  @ViewChild('inpburnable') inpburnable;
  burnableInput: boolean = false;

  @ViewChild('inponlyxrp') inponlyxrp;
  onlyXrpInput: boolean = false;

  @ViewChild('inptransferable') inptransferable;
  transferableInput: boolean = false;

  originalAccountInfo:any;
  isTestMode:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private accountObjectsChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  escrowsChanged: Subject<AccountObjectsChanged> = new Subject<AccountObjectsChanged>();

  showEscrowSequenceSelectedStyle:boolean = false;
  escrowSequenceSelected:boolean = false;
  showPassword:boolean = true;

  isValidNFTokenMint = false;
  validTaxon = false;
  validIssuer = false;
  validTransferFee = false;
  validCondition = false;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      this.isTestMode = accountData.mode;

      this.clearInputs();
      
      if(this.originalAccountInfo && this.originalAccountInfo.Account) {
      } else {
      }
      
    });

    this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(accountObjects => {
      //console.log("account objects changed received")
      if(accountObjects && accountObjects.objects) {
      } else {
      }
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs();
    });
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.accountObjectsChangedSubscription)
      this.accountObjectsChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('escrow_finish', 'sendToXumm', 'escrow_finish_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "EscrowFinish"
      }
    }

    payload.custom_meta = {};

    if(this.escrowOwnerInput && this.escrowOwnerInput.trim().length>0 && this.validAddress) {
      payload.txjson.Owner = this.escrowOwnerInput.trim();
      payload.custom_meta.instruction = "- Escrow Owner: " +this.escrowOwnerInput.trim();
    }

    if(this.escrowSequenceInput && this.validSequence) {
      payload.txjson.OfferSequence = Number(this.escrowSequenceInput);
      payload.custom_meta.instruction += "\n- Escrow Sequence: " + this.escrowSequenceInput;
    }

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      import('five-bells-condition').then( cryptoCondition => {
        let myFulfillment = new cryptoCondition.PreimageSha256();

        myFulfillment.setPreimage(fulfillment_bytes);

        let fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
        //console.log('Fulfillment: ', fulfillment)
        //console.log('             ', myFulfillment.serializeUri())

        var condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase()
        //console.log('Condition  : ', condition)
        // 'A0258020' + sha256(fulfillment_bytes) + '810102'
        //console.log('             ', myFulfillment.getCondition().serializeUri())

        //console.log()

        //console.log(
        //  'Fulfillment valid for Condition?      ',
        //    cryptoCondition.validateFulfillment(
        //    cryptoCondition.Fulfillment.fromBinary(Buffer.from(fulfillment, 'hex')).serializeUri(), 
        //    cryptoCondition.Condition.fromBinary(Buffer.from(condition, 'hex')).serializeUri()
        //  )
        //)

        //console.log("fulfillment_bytes.length: " + fulfillment_bytes.length);

        payload.txjson.Condition = condition
        payload.txjson.Fulfillment = fulfillment;

        payload.txjson.Fee = (330 + (10 * Math.ceil(Buffer.byteLength(fulfillment_bytes)/16))).toString();

        payload.custom_meta.instruction += "\n- With a password ✓"

        this.onPayload.emit(payload);
      });
    } else {
      this.onPayload.emit(payload);
    }
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    //console.log(this.escrowSequenceInput);

    this.validIssuer = !this.issuerInput || (this.issuerInput && this.issuerInput.trim().length > 0 && isValidXRPAddress(this.issuerInput.trim()));

    this.validTaxon = Number.isInteger(Number(this.taxonInput)) && parseInt(this.taxonInput) > 0 && parseInt(this.taxonInput) < 4294967295;

    this.validTransferFee = !(/[^.0-9]|\d{1,2}\.\d{16,}/.test(this.transferFeeInput));

    this.isValidNFTokenMint = this.validIssuer && this.validTaxon && this.validTransferFee;

    //console.log("isValidEscrowFinish: " + this.isValidEscrowFinish);
  }

  clearInputs() {
    this.escrowOwnerInput = this.escrowSequenceInput = this.passwordInput = null;
    this.isValidEscrowFinish = this.validAddress = this.validSequence = this.escrowOwnerChangedAutomatically = this.validCondition = false;
    this.lastKnownAddress = null;
    
    this.escrowAccountChanged.next({account: null, mode: this.isTestMode});
  }

  onEscrowSequenceFound(escrowInfo:any) {
    if(this.escrowOwnerInput && this.escrowOwnerInput.trim() != escrowInfo.owner) {
      this.escrowOwnerInput = escrowInfo.owner;
      this.escrowOwnerChangedAutomatically = true;
      setTimeout(() => this.escrowOwnerChangedAutomatically = false, 5000);
    }
    this.escrowSequenceInput = escrowInfo.sequence;
    
    this.escrowSequenceSelected = true;
    this.showPassword = escrowInfo.condition;
    
    this.checkChanges();

    this.showEscrowSequenceSelectedStyle = true;
    setTimeout(() => this.showEscrowSequenceSelectedStyle = false, 1000);
  }
}
