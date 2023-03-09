import { Component } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { LocalStorageService } from 'angular-2-local-storage';
import { XummTypes } from 'xumm-sdk';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';

@Component({
  selector: 'nft-api-backend',
  templateUrl: './nft-api-backend.html',
})
export class NftApiBackend {

  constructor(private localStorage: LocalStorageService, private payDialog: MatDialog, private snackBar: MatSnackBar) {}
  
  async payViaXumm() {
    //setting up xumm payload and waiting for websocket
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
          TransactionType: "Payment",
          Memos: [{Memo: {MemoType: Buffer.from("[https://xrpl.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from("Payment for using NFT API: https://api.xrpldata.com/docs", 'utf8').toString('hex').toUpperCase()}}]
      },
      custom_meta: {
        instruction: "You are about to pay for the XRP Ledger Services NFT API.\nPlease make sure to set the correct XRP amount for your choosen Tier/Rate Limit!",
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
