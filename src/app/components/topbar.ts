import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.html'
})
export class TopbarComponent {

  constructor( private supportDialog: MatDialog, private snackBar: MatSnackBar) {

  }

  async supportViaXumm() {
    //setting up xumm payload and waiting for websocket
    let xummPayload:any = {
      options: {
          expire: 5
      },
      txjson: {
          TransactionType: "Payment",
          Fee: "12"
      }
    }

    this.openGenericDialog(xummPayload);
  }

  openGenericDialog(payload: any):void {
    const dialogRef = this.supportDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: payload
    });

    dialogRef.afterClosed().subscribe((transactionInfo:any) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(transactionInfo));

      if(transactionInfo && transactionInfo.success && !transactionInfo.testnet) {
        this.snackBar.open("Thank you so much for your donation!", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    });
  }
}
