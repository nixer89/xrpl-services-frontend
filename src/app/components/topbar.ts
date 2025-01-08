import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';
import { XummTypes } from 'xumm-sdk';
import { LocalStorageService } from 'angular-2-local-storage'
import { OverlayContainer } from '@angular/cdk/overlay';
import { TypeWriter } from '../utils/TypeWriter';
import { XummService } from '../services/xumm.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.html'
})
export class TopbarComponent implements OnInit {
    
  @Output()
  darkThemeChanged: EventEmitter<boolean> = new EventEmitter();

  isDarkTheme: boolean;

  title: string = "XRPL Services";
  tw: TypeWriter

  loadingBackend:boolean = true;
  backendAvailable:boolean = false;

  constructor( private xummApi: XummService, private supportDialog: MatDialog, private snackBar: MatSnackBar, private localStorage: LocalStorageService, private overlayContainer: OverlayContainer) {
    
  }

  async ngOnInit(): Promise<void> {
    this.loadingBackend = true;
    this.backendAvailable = await this.xummApi.ping();
    this.loadingBackend = false;
    //console.log("backendAvailable: " + this.backendAvailable)

    this.isDarkTheme = this.localStorage.get("darkMode");
    this.setOverlayClass();

    this.tw = new TypeWriter(["XRP Ledger Services", "created by nixerFFM", "XRP Ledger Services"], t => {
      this.title = t;
    })

    this.tw.start();
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
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
          TransactionType: "Payment"
      },
      custom_meta: {
        instruction: "You are about to send some love to xrpl.services,\na project by @nixerFFM and not affiliated with XRPLLabs,\nthe creator of the Xaman wallet.\n\nThank you for your kindness, we appreciate you!!",
        blob: {
          isDonation: true,
          purpose: "freiwillige Zahlung für xrpl.services Webseite"
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
          this.snackBar.open("Your donation was submitted to the testnet. Thank you! But please consider sending a 'real' donation. :-)", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    });
  }
}
