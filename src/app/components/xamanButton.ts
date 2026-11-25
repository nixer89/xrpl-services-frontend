import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * "Sign in with Xaman" / "Pay with Xaman" button.
 * Same look as the sign button of the generic payload dialog.
 *
 * Usage: <xaman-button action="signin" (click)="login()"></xaman-button>
 * The click bubbles up from the inner button, so (click) and matTooltip work on the host element.
 */
@Component({
    selector: 'xaman-button',
    template: `
      <button mat-flat-button color="primary" type="button" class="xaman-button" [class.xaman-button-small]="size === 'small'" [attr.aria-label]="label">
        <mat-icon>qr_code_2</mat-icon>
        {{label}}
      </button>
    `,
    styles: [`
      :host {
        display: inline-block;
      }

      .xaman-button {
        height: 40px;
        padding: 0 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .xaman-button.xaman-button-small {
        height: 34px;
        padding: 0 14px;
        font-size: 13px;
      }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class XamanButtonComponent {
  @Input() action: 'signin' | 'pay' = 'signin';
  @Input() size: 'normal' | 'small' = 'normal';

  get label(): string {
    return this.action === 'pay' ? 'Pay with Xaman' : 'Sign in with Xaman';
  }
}
