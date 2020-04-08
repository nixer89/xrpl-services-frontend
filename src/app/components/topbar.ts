import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { LocalStorageService } from 'angular-2-local-storage'
import { OverlayContainer } from '@angular/cdk/overlay';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.html'
})
export class TopbarComponent implements OnInit {
    
  @Output()
  darkThemeChanged: EventEmitter<boolean> = new EventEmitter();

  isDarkTheme: boolean;

  constructor( private supportDialog: MatDialog, private snackBar: MatSnackBar, private localStorage: LocalStorageService, private overlayContainer: OverlayContainer) {
    
  }

  ngOnInit(): void {
    this.isDarkTheme = this.localStorage.get("darkMode");
    this.setOverlayClass();
  }

  toggleDarkTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    this.darkThemeChanged.emit(this.isDarkTheme);
    this.localStorage.set("darkMode", this.isDarkTheme);
    this.setOverlayClass();
  }

  setOverlayClass() {
    if(!this.isDarkTheme) {
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.add('light-theme');
    } else {
      this.overlayContainer.getContainerElement().classList.remove('light-theme');
      this.overlayContainer.getContainerElement().classList.add('dark-theme');
    }
  }

  async supportViaXumm() {
    //setting up xumm payload and waiting for websocket
    let xummPayload:XummPostPayloadBodyJson = {
      txjson: {
          TransactionType: "Payment",
          Fee: "12"
      }
    }

    this.openGenericDialog(xummPayload);
  }

  openGenericDialog(xummPayload: XummPostPayloadBodyJson):void {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.localStorage.get("xrplAccount"),
        referer: 'abcde'
      },
      payload: xummPayload
    }

    const dialogRef = this.supportDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe((transactionInfo:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(transactionInfo));

      if(transactionInfo && transactionInfo.success) {
        if(!transactionInfo.testnet)
          this.snackBar.open("Thank you so much for your donation!", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        else
          this.snackBar.open("Your donation was submitted to the testnet. Please consider sending a 'real' donation. Thank you :-)", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    });
  }
}
