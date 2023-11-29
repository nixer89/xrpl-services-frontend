import { Component, OnInit } from '@angular/core';
import { AppService } from '../services/app.service';
import * as normalizer from 'src/app/utils/normalizers';

@Component({
  selector: 'xahau-statistics',
  templateUrl: './xahau-statistics.html',
  styleUrls: ['./xahau-statistics.css']
})
export class XahauStatistics implements OnInit {
  
  constructor(private app: AppService) {}

  defaultData = {property_count: {}, special_data: {}, flags: {}};

  loading:boolean = false;
  tooManyRequests:boolean = false;

  generalStats:any = this.defaultData;
  accountrootStats:any = this.defaultData;
  ripplestateStats:any = this.defaultData;
  directorynodeStats:any = this.defaultData;
  offerStats:any = this.defaultData;
  signerlistStats:any = this.defaultData;
  ticketStats:any = this.defaultData;
  escrowStats:any = this.defaultData;
  ledgerhashesStats:any  = this.defaultData;
  paychannelStats:any = this.defaultData;
  checkStats:any = this.defaultData;
  depositpreauthStats:any = this.defaultData;
  feesettingsStats:any = this.defaultData;
  amendmentsStats:any = this.defaultData;
  uritokenStats:any = this.defaultData;

  totalNumberOfObjects: number = 0;


  async ngOnInit() {
    this.loading = true;
    
    try {
      let xahauStatistics:any = await this.app.get('https://api.xahaudata.com/api/v1/ledgerdata');

      if(xahauStatistics) {
        this.generalStats = {
          ledger_index: xahauStatistics.ledger_index,
          ledger_hash: xahauStatistics.ledger_hash,
          ledger_close: new Date(normalizer.rippleEpocheTimeToUTC(xahauStatistics.ledger_close_ms)).toLocaleString(),
          ledger_close_ms: xahauStatistics.ledger_close_ms,
          ledger_size: xahauStatistics.ledger_size,
          sizeType: xahauStatistics.sizeType
        }

        this.totalNumberOfObjects = 0;

        let ledger_data = xahauStatistics.ledger_data;

        if(ledger_data) {

          for (let xrplObject in ledger_data) {
            if (ledger_data[xrplObject].hasOwnProperty('count')) {
              this.totalNumberOfObjects = this.totalNumberOfObjects + ledger_data[xrplObject]['count'];
            }
          }

          if(ledger_data.ripplestate)
            this.ripplestateStats = ledger_data.ripplestate;

          if(ledger_data.accountroot)
            this.accountrootStats = ledger_data.accountroot;

          if(ledger_data.directorynode)
            this.directorynodeStats = ledger_data.directorynode;

          if(ledger_data.offer)
            this.offerStats = ledger_data.offer;

          if(ledger_data.signerlist)
            this.signerlistStats = ledger_data.signerlist;

          if(ledger_data.ticket)
            this.ticketStats = ledger_data.ticket;

          if(ledger_data.escrow)
            this.escrowStats = ledger_data.escrow;

          if(ledger_data.ledgerhashes)
            this.ledgerhashesStats = ledger_data.ledgerhashes;

          if(ledger_data.paychannel)
            this.paychannelStats = ledger_data.paychannel;

          if(ledger_data.check)
            this.checkStats = ledger_data.check;

          if(ledger_data.depositpreauth)
            this.depositpreauthStats = ledger_data.depositpreauth;

          if(ledger_data.feesettings)
            this.feesettingsStats = ledger_data.feesettings;

          if(ledger_data.amendments)
            this.amendmentsStats = ledger_data.amendments;

          if(ledger_data.uritoken)
            this.uritokenStats = ledger_data.uritoken;

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
    if(number && multiplier)
      return Math.round(number * multiplier) / multiplier;
    else
      return 0;
  }

  numberWithCommas(x) {
    if(x)
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    else
      return "0";
  }
}
