import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummService } from '../../services/xumm.service'
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from '../../utils/types';
import * as flagUtil from '../../utils/flagutils';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';
import * as normalizer from '../../utils/normalizers';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'createToken',
  templateUrl: './createToken.html'
})
export class CreateToken implements OnInit {

  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;
  private ACCOUNT_FLAG_DISABLE_MASTER_KEY:number = 4;
  private ACCOUNT_FLAG_DISABLE_INCOMING_XRP:number = 3;

  constructor(
    private matDialog: MatDialog,
    private xummApi: XummService,
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

  currencyCode:string;
  limit:number;
  validCurrencyCode:boolean = false;
  validLimit:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentNotSuccessfull:boolean = false;
  paymentNotFound: boolean = false;
  loadingIssuerAccount:boolean = false;

  needDefaultRipple:boolean = true;
  recipientAddress:string;
  recipientTrustlineSet:boolean = false;
  weHaveIssued:boolean = false;

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

  payForToken() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "Payment",
          Memos : [{Memo: {MemoType: Buffer.from("[https://xrpl.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for creating Token: '"+this.currencyCode.trim()+"'", 'utf8').toString('hex').toUpperCase()}}]
        },
        custom_meta: {
          instruction: "Please pay with the account you want to issue your Token from!",
          blob: {
            purpose: "Token Creation Service"
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

      if(info && info.success && info.account && (!info.testnet || this.isTestMode)) {
        if(isValidXRPAddress(info.account))
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
      } else {
        this.paymentNotSuccessfull = true;
        this.paymentNotFound = false;
      }
    });
  }

  loginForToken() {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The signin dialog was closed: ' + JSON.stringify(info));
      this.loadingIssuerAccount = true;

      if(info && info.success && info.account && isValidXRPAddress(info.account)) {
        let refererURL:string;
        if(document.URL.includes('?')) {
            refererURL = document.URL.substring(0, document.URL.indexOf('?'));
        } else {
            refererURL = document.URL;
        }
        let checkPayment:TransactionValidation = await this.xummApi.signInToValidateTimedPayment(info.payloadId, refererURL);
        //console.log("login to validate payment: " + JSON.stringify(checkPayment));
        if(checkPayment && checkPayment.success && (!checkPayment.testnet || this.isTestMode)) {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
        } else {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotFound = true;
          this.paymentNotSuccessfull = false;
          this.loadingIssuerAccount = false;
        }
      } else if(info && info.account) {
        this.issuerAccount = info.account;
        this.validIssuer = true;
        this.paymentNotFound = true;
        this.paymentNotSuccessfull = false;
        this.loadingIssuerAccount = false;
      } else {
        this.issuerAccount = null;
        this.validIssuer = false;
        this.loadingIssuerAccount = false;
      }
    });
  }

  async loadAccountData() {
    if(this.issuerAccount) {
      this.loadingIssuerAccount = true;

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
            this.needDefaultRipple = !flagUtil.isDefaultRippleEnabled(this.issuer_account_info.Flags)
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
        this.needDefaultRipple = true;
        this.blackholeMasterDisabled = false;
        this.loadingIssuerAccount = false;
      }
    }
  }

  sendDefaultRipple() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.issuerAccount
      },
      payload: {
        txjson: {
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DEFAULT_RIPPLE
        },
        custom_meta: {
          instruction: "- Set 'DefaultRipple' flag to the issuing account\n\n- Please sign with the ISSUER account!"
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

      if(info && info.success && info.testnet == this.isTestMode) {
        if(this.issuerAccount === info.account)
          await this.loadAccountData();
        else { //signed with wrong account

        }
      } else {

      }
    });
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && /^[a-zA-Z\d?!@#$%^&*<>(){}[\]|]{3,20}$/.test(this.currencyCode) && this.currencyCode.toUpperCase() != "XRP";
  }

  getCurrencyCodeForXRPL(): string {
    return normalizer.getCurrencyCodeForXRPL(this.currencyCode);
  }

  checkChangesLimit() {
    this.validLimit = this.limit && this.limit > 0 && !(/[^.0-9]|\d*\.\d{16,}/.test(this.limit.toString()));

    if(this.validLimit && this.limit.toString().includes('.') && this.limit.toString().substring(0,this.limit.toString().indexOf('.')).length > 40)
      this.validLimit = false;
  }

  setTrustline() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: null
      },
      payload: {
        txjson: {
          TransactionType: "TrustSet",
          Flags: 131072, //no ripple
          LimitAmount: {
            currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode),
            issuer: this.issuerAccount.trim(),
            value: normalizer.tokenNormalizer(this.limit.toString())
          }
        },
        custom_meta: {
          instruction: "- Set TrustLine between Token recipient and issuer\n\n- Please sign with the RECIPIENT account!"
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
         this.recipientTrustlineSet = true;
         this.recipientAddress = info.account;
      } else {
        this.recipientTrustlineSet = false;
      }
    });
  }

  issueToken() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.issuerAccount
      },
      payload: {
        txjson: {
          TransactionType: "Payment",
          Destination: this.recipientAddress,
          Amount: {
            currency: normalizer.getCurrencyCodeForXRPL(this.currencyCode),
            issuer: this.issuerAccount.trim(),
            value: normalizer.tokenNormalizer(this.limit.toString())
          },
          Flags: 131072
        },
        custom_meta: {
          instruction: "- Issuing " + this.limit + " " + this.currencyCode + " to: " + this.recipientAddress + "\n\n- Please sign with the ISSUER account!"
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
        this.weHaveIssued = true;
      } else {
        this.weHaveIssued = false;
      }
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

    switch(this.stepper.selectedIndex) {
      case 0: break;
      case 1: {
        this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxIssuerInfo = false;
        break;
      }
      case 2: {
        this.isTestMode = false;
        break;
      }
      case 3: {
        this.currencyCode = null;
        this.limit = null;
        this.validCurrencyCode = false;
        this.validLimit = false;
        break;
      }
      case 4: {
        this.issuerAccount = this.issuer_account_info = null;
        this.validIssuer = false;
        this.paymentNotFound = this.paymentNotSuccessfull = false;
        this.needDefaultRipple = true;
        break;
      }
      case 5: {
        break;
      }
      case 6: {
        this.recipientTrustlineSet = false;
        this.recipientAddress = null;
        break;
      }
      case 7: {
        this.weHaveIssued = false;
        break;
      }
      case 8: {
        this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 = this.checkBoxBlackhole5 = false;
        this.blackholeRegularKeySet = this.blackholeMasterDisabled = this.blackholeDisallowXrp = false;
        break;
      }
      case 9: break;
    }

    this.stepper.previous();
  }

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.paymentNotFound = false;
    this.paymentNotSuccessfull = false;
    this.validIssuer = false;
    this.issuer_account_info = null;
    this.needDefaultRipple = true;
  }

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = this.checkBoxDisclaimer = this.checkBoxIssuingText = this.checkBoxIssuerInfo = false;
    this.currencyCode = this.limit = null;
    this.validCurrencyCode = this.validLimit = false;
    this.issuerAccount = this.issuer_account_info = null;
    this.validIssuer = this.paymentNotFound = this.paymentNotSuccessfull = false;
    this.needDefaultRipple = true;
    this.recipientTrustlineSet = false;
    this.recipientAddress = null;
    this.weHaveIssued = false;
    this.checkBoxBlackhole1 = this.checkBoxBlackhole2 = this.checkBoxBlackhole3 = this.checkBoxBlackhole4 =this.checkBoxBlackhole5 = false;
    this.blackholeMasterDisabled = this.blackholeRegularKeySet = this.blackholeDisallowXrp =  false;
    this.stepper.reset();
  }
}
