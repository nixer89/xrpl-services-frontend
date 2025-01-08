import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from '../../utils/types';
import * as flagUtil from '../../utils/flagutils';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';
import { isValidXRPAddress } from 'src/app/utils/utils';
import { XummService } from 'src/app/services/xumm.service';
import { Router } from '@angular/router';

@Component({
  selector: 'blackholeAccount',
  templateUrl: './blackholeAccount.html'
})
export class BlackholeAccount implements OnInit {

  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;
  private ACCOUNT_FLAG_DISABLE_INCOMING_XRP:number = 3;

  constructor(
    private xummBackend: XummService,
    private matDialog: MatDialog,
    private device: DeviceDetectorService,
    private xrplWebSocket: XRPLWebsocket,
    private router: Router) { }

  checkBoxTwoAccounts:boolean = false;
  checkBoxIssuerInfo:boolean = false;
  checkBoxSufficientFunds:boolean = false;
  checkBoxFiveXrp:boolean = false;
  checkBoxNetwork:boolean = false;
  checkBoxNoLiability:boolean = false;
  checkBoxDisclaimer:boolean = false;

  checkBoxBlackhole1:boolean = false;
  checkBoxBlackhole2:boolean = false;
  checkBoxBlackhole3:boolean = false;
  checkBoxBlackhole4:boolean = false;
  checkBoxBlackhole5:boolean = false;

  checkBoxIssuingText:boolean = false;

  checkBoxIgnoreOwnerCount:boolean = false;

  hasSignerList:boolean = false;

  hasTokenBalance:boolean = false;
  hasOwnerCount:boolean = false;

  blackholeDisallowXrp:boolean = false;
  blackholeRegularKeySet:boolean = false;
  blackholeMasterDisabled:boolean = false;

  issuer_account_info:any;
  recipient_account_info:any;
  isTestMode:boolean = false;

  private issuerAccount: string;
  private recipientAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;
  validRecipient:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentInitiated: boolean = false;
  paymentNotSuccessfull:boolean = true;
  loadingIssuerAccount:boolean = false;
  loadingTokens:boolean = false;

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  paymentAmount:number = 15;
  paymentCurrency:string = "XRP";

  @ViewChild('stepper') stepper: MatStepper;

  async ngOnInit() {
    this.loadFeeReserves();
    try {
      //load payment amount
      let fixAmounts:any = await this.xummBackend.getFixAmounts();
      //console.log("resolved fix amounts: " + JSON.stringify(fixAmounts));

      //console.log("origin: " + window.location.origin+this.router.url)

      if(fixAmounts && fixAmounts[window.location.origin+this.router.url]) {
        let amount = fixAmounts[window.location.origin+this.router.url];

        if(amount && !amount.issuer) {
          let blackholeAmount:number = Number(fixAmounts[window.location.origin+this.router.url]);
          this.paymentAmount = blackholeAmount / 1000000;
          this.paymentCurrency = "XRP"
        } else if(amount && amount.issuer) {
          this.paymentAmount = amount.value;
          this.paymentCurrency = amount.currency;
        }
      }

    } catch(err) {

    }

    await this.loadAccountData();
  }

  isDektop(): boolean {
    return this.device.isDesktop();
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  loginForBlackhole() {
    this.loadingIssuerAccount = true;
    this.loadingTokens = true;

    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The signin dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account && isValidXRPAddress(info.account)) {
        this.issuerAccount = info.account;
        this.validIssuer = true;

        //load balance data
        let accountLinesCommand:any = {
          command: "account_lines",
          account: info.account,
          ledger_index: "validated"
        }

        let accountLines:any = await this.xrplWebSocket.getWebsocketMessage('blackhole_component_2', accountLinesCommand, this.isTestMode);
        //console.log("accountLines: " + JSON.stringify(accountLines));
        
        this.hasTokenBalance = accountLines && accountLines.result && accountLines.result.lines && accountLines.result.lines.length > 0 && accountLines.result.lines.filter(line => Number(line.balance) > 0).length > 0;

        await this.loadAccountData();

        this.loadingIssuerAccount = false;
        this.loadingTokens = false;
      } else {
        this.issuerAccount = null;
        this.validIssuer = false;
        this.loadingIssuerAccount = false;
        this.loadingTokens = false;
      }
    });
  }

  signInWithRecipientAccount() {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The signin dialog was closed: ' + JSON.stringify(info));
      this.loadingIssuerAccount = true;

      if(info && info.success && info.account && isValidXRPAddress(info.account)) {
        await this.loadAccountDataRecipient(info.account);
        this.recipientAccount = info.account;
        this.validRecipient = true;

        //load balance data

        this.loadingIssuerAccount = false;
      } else {
        this.recipientAccount = null;
        this.validRecipient = false;
        this.loadingIssuerAccount = false;
      }
    });
  }

  payForBlackhole() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "Payment",
          Memos : [{Memo: {MemoType: Buffer.from("[https://xrpl.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment to blackhole XRPL account.", 'utf8').toString('hex').toUpperCase()}}]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to remove all access for!",
          blob: {
            purpose: "Blackhole Account Service"
          }
        }
      }
    } 
    
    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));
      this.paymentInitiated = true;

      if(info && info.success && info.account && (!info.testnet || this.isTestMode)) {
        if(isValidXRPAddress(info.account))
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;

          //refresh amounts
          await this.loadAccountData();
      } else {
        this.paymentNotSuccessfull = true;
      }
    });
  }

  async loadAccountData() {
    if(this.issuerAccount) {
      this.loadingIssuerAccount = true;

      let account_info_request:any = {
        command: "account_info",
        account: this.issuerAccount,
        signer_lists: true,
        "strict": true,
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("blackhole_component_2", account_info_request, this.isTestMode);
      //console.log("websocket message: " + JSON.stringify(message));
      if(message.status && message.type && message.type === 'response') {
        if(message.status === 'success') {
          if(message.result && message.result.account_data) {
            this.issuer_account_info = message.result.account_data;
            //console.log("isser_account_info: " + JSON.stringify(this.issuer_account_info));

            if(this.issuer_account_info.Flags > 0) {
              this.blackholeDisallowXrp = flagUtil.isDisallowXRPEnabled(this.issuer_account_info.Flags);
              this.blackholeMasterDisabled = flagUtil.isMasterKeyDisabled(this.issuer_account_info.Flags);
            }

            this.hasOwnerCount = this.issuer_account_info.OwnerCount && this.issuer_account_info.OwnerCount > 0;
            this.checkBoxIgnoreOwnerCount = !this.hasOwnerCount;

            //console.log("signer list: " + JSON.stringify(message.result.account_data.signer_lists));

            this.hasSignerList = message.result.account_data.signer_lists && message.result.account_data.signer_lists.length > 0;

            //console.log("Balance: " + this.getAvailableBalanceIssuer());
            //console.log("blackholeDisallowXrp: " + this.blackholeDisallowXrp);
            //console.log("blackholeMasterDisabled: " + this.blackholeMasterDisabled);
            //console.log("hasSignerList: " + this.hasSignerList);

          } else {
            //console.log(JSON.stringify(message));
          }
          
          this.loadingIssuerAccount = false;

        } else {
          if(message.request.command === 'account_info') {
            this.issuer_account_info = message;
            this.loadingIssuerAccount = false;
          }
        }
      } else {
        this.issuer_account_info = null;
        this.blackholeMasterDisabled = false;
        this.loadingIssuerAccount = false;
      }
    }
  }

  async loadAccountDataRecipient(xrplAccount: string) {
    this.loadingIssuerAccount = true;
    //this.infoLabel = "loading " + xrplAccount;
    if(xrplAccount && isValidXRPAddress(xrplAccount)) {
      this.loadingIssuerAccount = true;
      
      let account_info_request:any = {
        command: "account_info",
        account: xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebSocket.getWebsocketMessage("blackhole_component", account_info_request, this.isTestMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));
      //this.infoLabel = JSON.stringify(message_acc_info);
      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.recipient_account_info = message_acc_info.result.account_data;
        } else {
          this.recipient_account_info = message_acc_info;
        }
      } else {
        this.recipient_account_info = "no account";
      }
    } else {
      this.recipient_account_info = "no account"
    }
  }

  sendRemainingXRP() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "Payment",
          Destination: this.recipient_account_info.Account,
          Amount: this.getAvailableBalanceIssuer()*1000000+""
        },
        custom_meta: {
          instruction: "- Sending " + this.getAvailableBalanceIssuer() + " XRP to an account of your choice.\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));
      //refresh account data
      await this.loadAccountData();
    });

  }

  disallowIncomingXrp() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_INCOMING_XRP
        },
        custom_meta: {
          instruction: "- Disallow incoming XRP\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
        this.blackholeDisallowXrp = true;
      } else {
        this.blackholeDisallowXrp = false;
      }
    });

  }

  setBlackholeAddress() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "SetRegularKey",
          RegularKey: "rrrrrrrrrrrrrrrrrrrrBZbvji"
        },
        custom_meta: {
          instruction: "Set RegularKey to: rrrrrrrrrrrrrrrrrrrrBZbvji\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
        this.blackholeRegularKeySet = true;
      } else {
        this.blackholeRegularKeySet = false;
      }
    });

  }

  disableMasterKeyForIssuer() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DISABLE_MASTER_KEY
        },
        custom_meta: {
          instruction: "- Disable Master Key\n\n- Please sign with the ISSUER account!"
        }
      }
    }

    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
        this.blackholeMasterDisabled = true;
      } else {
        this.blackholeMasterDisabled = false;
      }
    });
  }


  deleteSignerList() {

    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          Account: this.getIssuer(),
          TransactionType: "SignerListSet",
          SignerQuorum: 0
        },
        custom_meta: {
          instruction: 'Delete Signer List.'
        }
      }
    }

    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));
      await this.loadAccountData();
    });
  }

  getAvailableBalanceIssuer(): number {
    return this.getAvailableBalance(this.issuer_account_info);
  }

  getAvailableBalance(accountInfo: any): number {
    if(accountInfo && accountInfo.Balance) {
      let balance:number = Number(accountInfo.Balance);
      balance = balance - this.accountReserve; //deduct acc reserve
      balance = balance - (accountInfo.OwnerCount * this.ownerReserve); //deduct owner count
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance
      else
        return 0;
      
    } else {
      return 0;
    }
  }

  async loadFeeReserves() {
    let fee_request:any = {
      command: "ledger_entry",
      index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
      ledger_index: "validated"
    }

    let feeSettingResult:any = await this.xrplWebSocket.getWebsocketMessage("fee-settings", fee_request, this.isTestMode);
    
    let feeSettingObject = feeSettingResult?.result?.node;

    if('ReserveBase' in feeSettingObject) {
      this.accountReserve = feeSettingObject.ReserveBase;
      this.ownerReserve = feeSettingObject.ReserveIncrement;
    } else {
      this.accountReserve = Number(feeSettingObject.ReserveBaseDrops);
      this.ownerReserve = Number(feeSettingObject.ReserveIncrementDrops);
    }

    //console.log("resolved accountReserve: " + this.accountReserve);
    //console.log("resolved ownerReserve: " + this.ownerReserve);
  }

  moveNext() {
    // complete the current step
    this.stepper.selected.completed = true;
    this.stepper.selected.editable = false;
    // move to next step
    this.stepper.next();
    this.stepper.selected.editable = true;
  }

  moveBack() {
    //console.log("steps: " + this.stepper.steps.length);
    // move to previous step
    this.stepper.selected.completed = false;
    this.stepper.selected.editable = false;

    this.stepper.steps.forEach((item, index) => {
      if(index == this.stepper.selectedIndex-1 && this.stepper.selectedIndex-1 >= 0) {
        item.editable = true;
        item.completed = false;
      }
    })

    this.stepper.previous();
  }

  clearIssuerAccount() {
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxDisclaimer = this.checkBoxIssuingText = this.checkBoxIssuerInfo = false;
    this.issuerAccount = this.issuer_account_info = null;
    this.validIssuer = this.paymentNotSuccessfull = this.hasTokenBalance = false;
    this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 =this.checkBoxBlackhole5 = false;
    this.blackholeMasterDisabled = this.blackholeRegularKeySet = this.blackholeDisallowXrp =  false;
    this.hasTokenBalance = this.hasOwnerCount = this.hasSignerList = false;
  }

  reset() {
    this.isTestMode = false;
    this.clearIssuerAccount();
    this.stepper.reset();
  }
}
