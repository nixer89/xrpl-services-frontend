import { Component, OnInit, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { AccountInfoChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'accountdelete',
  templateUrl: './accountdelete.html'
})
export class AccountDeleteComponent implements OnInit, OnDestroy {

  constructor(private xrplWebSocket: XRPLWebsocket) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<void>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpdestinationaccount') inpdestinationaccount;
  destinationAccountInput: string;

  @ViewChild('inpdestinationtag') inpdestinationtag;
  destinationTagInput: string;

  private accountInfoChangedSubscription: Subscription;
  originalAccountInfo:any;

  private transactionSuccessfullSubscription: Subscription;

  isTestMode:boolean = false;

  destinationAccountExists:boolean = false;
  validDestinationAddress:boolean = false;
  validTag:boolean = false;

  lastKnownDestinationAccount:string;
  loadingDestinationAccount:boolean = false;
  loadingPreconditions:boolean = false;
  preconditionsFullFilled:boolean = true;

  errorMsg:string = null;
  checkBoxHint:boolean = false;

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(async accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData.info));
      this.originalAccountInfo = accountData.info;
      this.accountReserve = accountData.accountReserve;
      this.ownerReserve = accountData.ownerReserve;
      this.isTestMode = accountData.mode;
      
      if(this.originalAccountInfo && this.originalAccountInfo.Account) {
        await this.checkPreconditions();
      } else if(!this.originalAccountInfo || !this.originalAccountInfo.Account) {
        this.preconditionsFullFilled = true;
        this.loadingPreconditions = false;
      }

      await this.checkDestinationAccountExists();

    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });
  }

  ngOnDestroy() {
    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();
  }

  async checkPreconditions(): Promise<void> {
    //console.log("check preconditions");
    if(this.originalAccountInfo && this.originalAccountInfo.Account) {
      this.loadingPreconditions = true;
      this.errorMsg = null;

      let accountObjects:any[] = [];

      let account_objects_request:any = {
        command: "account_objects",
        ledger_index: "validated",
        account: this.originalAccountInfo.Account,
        deletion_blockers_only: true,
        limit: 201
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("accountdelete", account_objects_request, this.isTestMode);

      await this.handleWebSocketMessagePreconditions(message, accountObjects);
    }
  }

  async handleWebSocketMessagePreconditions(message: any, accountObjects:any[]): Promise<void> {
    //console.log("websocket message: " + JSON.stringify(message));
    if(message.status && message.type && message.type === 'response') {
      if(message.status === 'success' && message.result && message.result.account_objects && message.result.account === this.originalAccountInfo.Account) {
        accountObjects = message.result.account_objects;
        //console.log("accountObjects length: " + accountObjects.length);

        //check sequence number
        this.preconditionsFullFilled = (this.originalAccountInfo.Sequence+256) < message.result.ledger_index;
        //console.log("sequence check: " + this.preconditionsFullFilled)

        if(!this.preconditionsFullFilled)
          this.errorMsg = "You need to wait " + (this.originalAccountInfo.Sequence+256-message.result.ledger_index) + " more validated ledgers to delete your account. That is around " + ((this.originalAccountInfo.Sequence+256-message.result.ledger_index)*4 / 60) + " more minutes.";

        if(accountObjects.length > 1000) {
          //console.log("too many objects");
          this.preconditionsFullFilled = false;
          this.errorMsg = "Your account owns too many objects and cannot be deleted."
          this.loadingPreconditions = false;
        } else {
          if(accountObjects && accountObjects.length > 0) {
            //console.log("forbidden object detected");
            // we have one of the "forbidden" objects still attached to our account. Preconditions are not met.
            this.preconditionsFullFilled = false;

            let escrows:number = accountObjects.filter(object => object.LedgerEntryType === "Escrow").length;
            let paychans:number = accountObjects.filter(object => object.LedgerEntryType === "PayChannel").length;
            let trustLines:number = accountObjects.filter(object => object.LedgerEntryType === "RippleState").length;
            let checks:number = accountObjects.filter(object => object.LedgerEntryType === "Check").length;

            if(this.errorMsg)
              this.errorMsg += "\n\n"
            else
              this.errorMsg = ""

            this.errorMsg += "Account deletion is prevented by:"
            if(escrows > 0)
              this.errorMsg += "\n- Escrows: " + escrows;

            if(paychans > 0)
              this.errorMsg += "\n- Payment Channels: " + paychans;

            if(trustLines > 0)
              this.errorMsg += "\n- Trust Lines: " + trustLines;

            if(checks > 0)
              this.errorMsg += "\n- Checks: " + checks;

            this.errorMsg+= "\n\nYou can only delete your account if you have not linked any of the above objects to your account."
          }

          this.loadingPreconditions = false;
        } 
      } else {
        this.preconditionsFullFilled = false;
        this.loadingPreconditions = false;
      }
    } else {
      this.preconditionsFullFilled = false;
      this.loadingPreconditions = false;
    }
  }

  async checkDestinationAccountExists(): Promise<void> {
    if(this.destinationAccountInput && this.validDestinationAddress) {
      this.loadingDestinationAccount = true;

      let account_info_request:any = {
        command: "account_info",
        account: this.destinationAccountInput.trim(),
        "strict": true,
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("accountdelete", account_info_request, this.isTestMode);

      //console.log("check destination account: " + JSON.stringify(message));

      if(message.status && message.type && message.type === 'response') {
        if(message.status === 'success') {
          this.destinationAccountExists = message.result && message.result.account_data && message.result.account_data.Account === this.destinationAccountInput.trim();
        } else {
          this.destinationAccountExists = false;
        }

        this.loadingDestinationAccount = false;

      } else {
        this.destinationAccountExists = false;
        this.loadingDestinationAccount = false;
      }
    }
  }

  sendPayloadToXumm() {

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "AccountDelete"
      }
    }

    if(this.destinationAccountInput && this.destinationAccountInput.trim().length > 0 && this.validDestinationAddress) {
      payload.txjson.Destination = this.destinationAccountInput.trim();

      if(this.destinationTagInput && this.destinationTagInput.trim().length > 0 && this.validTag) {
        payload.txjson.DestinationTag = parseInt(this.destinationTagInput.trim());
      }

      payload.custom_meta = {}
      payload.custom_meta.instruction = "Delete your XRPL Account\n\n - please sign with the account you want to delete!";
    }

    this.onPayload.emit(payload);
  }

  async checkChanges() {   
    this.validDestinationAddress = this.destinationAccountInput && this.destinationAccountInput.trim().length > 0 && isValidXRPAddress(this.destinationAccountInput.trim());

    if(this.lastKnownDestinationAccount != this.destinationAccountInput.trim()) {
      this.lastKnownDestinationAccount = this.destinationAccountInput.trim()
      await this.checkDestinationAccountExists();
    }

    this.validTag = this.destinationTagInput && /^[0-9]+$/.test(this.destinationTagInput);

    if(this.validTag) {
      let numberTag:number = parseInt(this.destinationTagInput);
      this.validTag = numberTag >= 0 && numberTag <= 4294967295;
    }

    //console.log("validAddress: " + this.validAddress);
  }

  clearInputs() {
    this.destinationAccountInput = this.destinationTagInput = null;
    this.validTag = this.validDestinationAddress = false;
    this.loadingDestinationAccount = this.loadingPreconditions = this.checkBoxHint = false;
    this.preconditionsFullFilled = true;
    this.errorMsg = this.lastKnownDestinationAccount = null;
  }

  getAccountBalance(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      return balance/1000000;
    } else {
      return 0;
    }
  }

  getTransferBalance(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      return (balance-this.ownerReserve)/1000000;
    } else {
      return 0;
    }
  }
}
