import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
  selector: 'privacy',
  templateUrl: 'privacy.html'
})

export class PrivacyComponent implements OnInit {

  constructor(private titleService: Title, private googleAnalytics: GoogleAnalyticsService) {}

  ngOnInit() {
    this.titleService.setTitle("Xumm Community Privacy");
    this.googleAnalytics.analyticsEventEmitter('privacy_opened', 'privacy', 'privacy_component');
  }
}
