import { Component, OnInit } from '@angular/core';
import packageInfo from '../../../package.json';
import { XummService } from '../services/xumm.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html'
})
export class FooterComponent implements OnInit {

  public appVersion:string = packageInfo.version;

  constructor(private xummApi: XummService) { }

  //transactions:number = -1;

  async ngOnInit() {
    /**
    let stats = await this.xummApi.getTransactionStatistics();

    if(stats)
      this.transactions = 0;

    for (var trx in stats) {
      if (stats.hasOwnProperty(trx)) {
        this.transactions += stats[trx];
      }
    }
    **/
  }
}
