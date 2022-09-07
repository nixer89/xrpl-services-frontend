import { Component, OnInit } from '@angular/core';
import { AppService } from '../services/app.service';
import * as normalizer from 'src/app/utils/normalizers';

@Component({
  selector: 'xrpl-statistics',
  templateUrl: './xrpl-statistics.html',
  styleUrls: ['./xrpl-statistics.css']
})
export class XrplStatistics implements OnInit {
  
  constructor(private app: AppService) {}

  loading:boolean = false;
  tooManyRequests:boolean = false;

  generalStats:any = null;
  accountrootStats:any = null;
  ripplestateStats:any = null;
  directorynodeStats:any = null;
  offerStats:any = null;
  signerlistStats:any = null;
  ticketStats:any = null;
  escrowStats:any = null;
  ledgerhashesStats:any  = null;
  paychannelStats:any = null;
  checkStats:any = null;
  depositpreauthStats:any = null;
  feesettingsStats:any = null;
  amendmentsStats:any = null;


  async ngOnInit() {
    this.loading = true;
    
    try {
      let xrplStatistics:any = await this.app.get('https://api.xrpldata.com/api/v1/ledgerdata');

      if(xrplStatistics) {
        this.generalStats = {
          ledger_index: xrplStatistics.ledger_index,
          ledger_hash: xrplStatistics.ledger_hash,
          ledger_close: new Date(normalizer.rippleEpocheTimeToUTC(xrplStatistics.ledger_close_ms)).toLocaleString(),
          ledger_close_ms: xrplStatistics.ledger_close_ms,
          ledger_size: xrplStatistics.ledger_size,
          sizeType: xrplStatistics.sizeType
        }

        let totalNumberOfObjects: number = 0;

        let ledger_data = xrplStatistics.ledger_data;

        if(ledger_data) {

          for (var xrplObject in ledger_data) {
            if (ledger_data.hasOwnProperty(xrplObject)) {
              totalNumberOfObjects += xrplObject['count'];
            }
          }

          this.generalStats['all_objects_count'] = totalNumberOfObjects;

          this.ripplestateStats = ledger_data.ripplestate;
          this.accountrootStats = ledger_data.accountroot;
          this.directorynodeStats = ledger_data.directorynode;
          this.offerStats = ledger_data.offer;
          this.signerlistStats = ledger_data.signerlist;
          this.ticketStats = ledger_data.ticket;
          this.escrowStats = ledger_data.escrow;
          this.ledgerhashesStats = ledger_data.ledgerhashes;
          this.paychannelStats = ledger_data.paychannel;
          this.checkStats = ledger_data.check;
          this.depositpreauthStats = ledger_data.depositpreauth;
          this.feesettingsStats = ledger_data.feesettings;
          this.amendmentsStats = ledger_data.amendments;
        }

        this.tooManyRequests = false;
      }
    } catch(err) {
      console.log(JSON.stringify(err));

      if(err && err.includes("You are sending too many requests in a short period of time")) {
        this.tooManyRequests = true;
      } else {
        this.tooManyRequests = false;
      }
    }

    this.loading = false;
  }

  roundNumber(number: number, multiplier: number) : number {
    return Math.round(number * multiplier) / multiplier;
  }

  numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}
