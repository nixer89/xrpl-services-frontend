import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LocalStorageService } from 'angular-2-local-storage';
import { XummTypes } from 'xumm-sdk';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';

@Component({
  selector: 'uritoken-api-backend',
  templateUrl: './uritoken-api-backend.html',
})
export class NftApiBackend {

  constructor(private localStorage: LocalStorageService, private payDialog: MatDialog, private snackBar: MatSnackBar) {}
  
  async payViaXumm() {
    //setting up xumm payload and waiting for websocket
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
          TransactionType: "Payment",
          Memos: [{Memo: {MemoType: Buffer.from("[https://xahau.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for using URIToken / NFT API: https://xahau-api.xrpldata.com/docs", 'utf8').toString('hex').toUpperCase()}}]
      },
      custom_meta: {
        instruction: "You are about to pay for the Xahau  Services NFT API.\nPlease make sure to set the correct XAH amount for your choosen Tier/Rate Limit!",
        blob: {
          purpose: "payment for NFT API"
        }
      }
    }

    this.openGenericDialog(xummPayload);
  }

  openGenericDialog(xummPayload: XummTypes.XummPostPayloadBodyJson):void {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        testnet: false,
        xrplAccount: this.localStorage.get("xrplAccount"),
        referer: 'abcde'
      },
      payload: xummPayload
    }

    const dialogRef = this.payDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe((transactionInfo:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(transactionInfo));

      if(transactionInfo && transactionInfo.success) {
        if(!transactionInfo.testnet)
          this.snackBar.open("Thank you for the purchase!", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        else
          this.snackBar.open("Your payment was submitted to the testnet. Your API Key will soon be disabled. Please send a 'real' payment.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    });
  }
}
