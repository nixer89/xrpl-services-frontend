import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AppService } from '../../services/app.service';
import { Token, TokenIssuer } from '../../utils/types'
import * as normalizer from 'src/app/utils/normalizers';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'issuedTokenList',
  templateUrl: './issuedTokenList.html',
  styleUrls: ['./issuedTokenList.css']
})
export class IssuedTokenList implements OnInit {

  constructor(private app: AppService, private deviceDetector: DeviceDetectorService, private googleAnalytics: GoogleAnalyticsService) {}

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;


  displayedColumns: string[] = ['account', 'username', 'currency', 'amount', 'trustlines'];
  datasource:MatTableDataSource<TokenIssuer> = null;

  loading:boolean = false;

  pageSize:number = 25;
  
  ledgerIndex: string;
  ledgerHash: string;
  ledgerCloseTime: number;
  issuingAccounts: number = 0;

  async ngOnInit() {
    this.pageSize = this.deviceDetector.isMobile() ? 5 : this.pageSize;
    this.loading = true;
    let issuers:TokenIssuer[] = await this.loadLedgerData();
    this.loading = false;
  
    this.datasource = new MatTableDataSource(issuers);

    if(issuers != null) {
      this.datasource.paginator = this.paginator;
      this.datasource.sort = this.sort;
    }
  }

  async loadLedgerData(): Promise<TokenIssuer[]> {
    let tokenIssuers:TokenIssuer[] = [];
    try {
      let issuedTokensResponse:any = await this.app.get('http://localhost:4001/tokens');

      this.ledgerIndex = issuedTokensResponse.ledger_index;
      this.ledgerHash = issuedTokensResponse.ledger_hash;
      this.ledgerCloseTime = issuedTokensResponse.ledger_close_ms;
      this.issuingAccounts = 0;

      let issuers:any = issuedTokensResponse.tokens;

      for (var account in issuers) {
        if (issuers.hasOwnProperty(account)) {
            let issuedCurrencies:Token[] = issuers[account].tokens;
            let username:string = issuers[account].username;
            this.issuingAccounts++;
            issuedCurrencies.forEach(issuedCurrency => {

              if("rMZ7swk2CUfKr5uTnYtNu6Gf2gRiNJBj6n" === account)
                console.log(issuedCurrency.currency);

              tokenIssuers.push({account: account, currency: this.getCurrencyCode(issuedCurrency.currency), amount: issuedCurrency.amount, trustlines: issuedCurrency.trustlines, username: username});
            })
        }
      }
    } catch(err) {
      tokenIssuers = null
    }

    if(tokenIssuers && tokenIssuers.length == 0)
      tokenIssuers = null;

      console.log(tokenIssuers && tokenIssuers.length);
    return tokenIssuers;
  }

  stringToFloat(number: string): number {
    return parseFloat(number);
  }

  getCurrencyCode(currency: string): string {
      return normalizer.currencyCodeHexToAsciiTrimmed(currency);
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.datasource.filter = filterValue.trim().toLowerCase();
  }

  humanReadableCloseTime(): string {
    if(this.ledgerCloseTime != null && this.ledgerCloseTime > 0)
      return new Date(normalizer.rippleEpocheTimeToUTC(this.ledgerCloseTime)).toLocaleString();
    else
      return "";
  }
}
