import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private readonly prefix = 'XrplServices';
  private readonly delimiter = '.';

  // Compatibility with angular-2-local-storage's event stream used in a few components.
  readonly setItems$ = new Subject<{ key: string; newvalue: string }>();

  private fullKey(key: string): string {
    return `${this.prefix}${this.delimiter}${key}`;
  }

  get<T = any>(key: string): T | null {
    const raw = window.localStorage.getItem(this.fullKey(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Backwards-compat: some values may be stored as plain strings
      return raw as unknown as T;
    }
  }

  set<T = any>(key: string, value: T): void {
    window.localStorage.setItem(this.fullKey(key), JSON.stringify(value));
    this.setItems$.next({ key, newvalue: String(value) });
  }

  remove(key: string): void {
    window.localStorage.removeItem(this.fullKey(key));
  }

  keys(): string[] {
    const keys: string[] = [];
    const prefix = `${this.prefix}${this.delimiter}`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k.substring(prefix.length));
    }
    return keys;
  }
}

