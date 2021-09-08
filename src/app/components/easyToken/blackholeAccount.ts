import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from '../../utils/types';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as flagUtil from '../../utils/flagutils';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';
import * as normalizer from '../../utils/normalizers';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'blackholeAccount',
  templateUrl: './blackholeAccount.html'
})
export class BlackholeAccount implements OnInit {

  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;
  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;
  private ACCOUNT_FLAG_DISABLE_INCOMING_XRP:number = 3;

  constructor(
    private matDialog: MatDialog,
    private googleAnalytics: GoogleAnalyticsService,
    private device: DeviceDetectorService,
    private xrplWebSocket: XRPLWebsocket) { }

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

  blackholeDisallowXrp:boolean = false;
  blackholeRegularKeySet:boolean = false;
  blackholeMasterDisabled:boolean = false;

  issuer_account_info:any;
  isTestMode:boolean = false;

  private issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentNotSuccessfull:boolean = false;
  paymentNotFound: boolean = false;
  loadingIssuerAccount:boolean = false;

  @ViewChild('stepper') stepper: MatStepper;

  ngOnInit(): void {
    this.loadAccountData();
  }

  isDektop(): boolean {
    return this.device.isDesktop();
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  payForBlackhole() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "Payment",
          Memos : [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment to blackhole XRPL account.", 'utf8').toString('hex').toUpperCase()}}]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to remove all access for!"
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

      if(info && info.success && info.account && (!info.testnet || this.isTestMode)) {
        if(isValidXRPAddress(info.account))
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
          this.googleAnalytics.analyticsEventEmitter('pay_for_blackhole', 'blackhole', 'blackhole_component');
      } else {
        this.paymentNotSuccessfull = true;
        this.paymentNotFound = false;
      }
    });
  }

  async loadAccountData() {
    if(this.issuerAccount) {
      this.loadingIssuerAccount = true;
      this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'blackhole', 'blackhole_component');

      let account_info_request:any = {
        command: "account_info",
        account: this.issuerAccount,
        "strict": true,
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("easyToken", account_info_request, this.isTestMode);
      //console.log("websocket message: " + JSON.stringify(message));
      if(message.status && message.type && message.type === 'response') {
        if(message.status === 'success') {
          if(message.result && message.result.account_data) {
            this.issuer_account_info = message.result.account_data;
            //console.log("isser_account_info: " + JSON.stringify(this.issuer_account_info));
            this.blackholeDisallowXrp = flagUtil.isDisallowXRPEnabled(this.issuer_account_info.Flags);
            this.blackholeMasterDisabled = flagUtil.isMasterKeyDisabled(this.issuer_account_info.Flags)

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

  disallowIncomingXrp() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
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
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
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
        this.googleAnalytics.analyticsEventEmitter('account_black_hole_succeed', 'easy_token', 'easy_token_component');
      } else {
        this.blackholeMasterDisabled = false;
      }
    });

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
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.paymentNotFound = false;
    this.paymentNotSuccessfull = false;
    this.validIssuer = false;
    this.issuer_account_info = null;
  }

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxDisclaimer = this.checkBoxIssuingText = this.checkBoxIssuerInfo = false;
    this.issuerAccount = this.issuer_account_info = null;
    this.validIssuer = this.paymentNotFound = this.paymentNotSuccessfull = false;
    this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 =this.checkBoxBlackhole5 = false;
    this.blackholeMasterDisabled = this.blackholeRegularKeySet = this.blackholeDisallowXrp =  false;
    this.stepper.reset();
  }
}
