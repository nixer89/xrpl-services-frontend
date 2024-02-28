import { Component, ViewChild } from '@angular/core';
import { AppService } from '../../services/app.service';
import * as qrcode from 'qrcode';
import * as clipboard from 'copy-to-clipboard';
import { MatStepper } from '@angular/material/stepper';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'testNetCredentials',
  templateUrl: './testNetCredentials.html',
  styleUrls: ['./testNetCredentials.css']
})
export class TestNetCredentialsComponent {

  constructor(private app: AppService, private snackBar: MatSnackBar, private googleAnalytics: GoogleAnalyticsService) {}

  loading:boolean = false;
  error:string = null;
  qrCode: string = null;
  newAccount:any = null;
  checkBoxConsent:boolean = false;
  checkBoxXummConnected:boolean = false;
  checkBoxQrScannerOpened:boolean = false;
  checkBoxAccountAdded:boolean = false;

  @ViewChild('stepper') stepper: MatStepper;

  async createTestNetCredentials(): Promise<void> {
    this.loading = true;
    this.newAccount = null;
    this.qrCode = null;
    this.error = null;

    try {
      //call ripple servers to get testnet credentials with a balance
      this.newAccount = await this.app.post("https://faucet.altnet.rippletest.net/accounts", {});
      //this.newAccount = {"account":{"xAddress":"TVrRjmCE1twUKGbFBhdyR12pXqitZtAv6PjXB3E33Nm8hTQ","secret":"snEtbXeqo7f7Bg2oc552CV6yct4QW","classicAddress":"rUwnrWz9PnV7oFcFcpdkEjCbVUAEaZCgso","address":"rUwnrWz9PnV7oFcFcpdkEjCbVUAEaZCgso"},"amount":1000,"balance":1000};
      //console.log("credentials: " + JSON.stringify(this.newAccount));

      if(this.newAccount)
        this.qrCode = await qrcode.toDataURL(this.newAccount.seed);

      if(!this.newAccount || !this.qrCode)
        this.error = "Something went wrong. Please try again later! If the error persists, please report via twitter @XrplServices!"
      
    } catch(err) {
      console.log(err);
      this.newAccount = null;
      this.qrCode = null;
      this.error = "Could not load test net credentials. Please try again later! If the error persists, please report via twitter @XrplServices!";
    }

    this.loading = false;
  }

  copyFamilySeed() {
    if(this.newAccount && this.newAccount.account && this.newAccount.seed) {
      clipboard(this.newAccount.seed);
      this.snackBar.dismiss();
      this.snackBar.open("Family Seed copied to clipboard!", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom'});
    }
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
    });

    switch(this.stepper.selectedIndex) {
      case 0: break;
      case 1: {
        this.checkBoxConsent = false;
        this.checkBoxXummConnected = false;
        break;
      }
      case 2: {
        this.checkBoxXummConnected = false;
        this.checkBoxQrScannerOpened = false;
        break;
      }
      case 3: {
        this.checkBoxQrScannerOpened = false;
        this.checkBoxAccountAdded = false;
        this.newAccount = null;
        this.qrCode = null;
        this.error = null;
        this.loading = false;
        break;
      }
      case 4: {
        this.checkBoxAccountAdded = false;
        break;
      }
    }

    this.stepper.previous();
  }
}
