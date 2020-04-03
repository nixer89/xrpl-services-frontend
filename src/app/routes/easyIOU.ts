import { Component, ViewChild } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';

@Component({
  selector: 'easyIOU',
  templateUrl: './easyIOU.html',
})
export class EasyIOU {

  @ViewChild('inpissuer', {static: false}) inpissuer;
  issuerInput: string;

  validIssuer:boolean = false;

  checkChangesIssuer() {
    this.validIssuer = this.issuerInput && this.issuerInput.trim().length > 0 && this.isValidXRPAddress(this.issuerInput.trim());
  }
  
  isValidXRPAddress(address: string): boolean {
    try {
      //console.log("encoding address: " + address);
      let xAddress = Encode({account: address});
      //console.log("xAddress: " + xAddress);
      return xAddress && xAddress.length > 0;
    } catch(err) {
      //no valid address
      //console.log("err encoding " + err);
      return false;
    }
  }

}
