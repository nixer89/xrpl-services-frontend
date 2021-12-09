import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
  selector: 'terms',
  templateUrl: 'terms.html'
})

export class TermsComponent implements OnInit {

  constructor(private titleService: Title, private googleAnalytics: GoogleAnalyticsService) {}

  ngOnInit() {
    this.titleService.setTitle("XRPL Services Terms");
    this.googleAnalytics.analyticsEventEmitter('terms_opened', 'terms', 'terms_component');
  }
}
