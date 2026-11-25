import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface LocalStorageSetEvent {
  key: string;
  newvalue: string | null;
  storageType: 'localStorage';
}

/**
 * Drop-in replacement for the abandoned `angular-2-local-storage` package
 * (configured with prefix 'XahauServices', localStorage, notify on setItem).
 *
 * Storage format is kept identical (key = 'XahauServices.' + key, JSON-encoded value)
 * so values saved by previous versions of the app are still read correctly.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private readonly prefix = 'XahauServices.';
  private readonly setItemsSubject = new Subject<LocalStorageSetEvent>();

  readonly setItems$: Observable<LocalStorageSetEvent> = this.setItemsSubject.asObservable();

  private get storage(): Storage | null {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
      return null;
    }
  }

  private deriveKey(key: string): string {
    return this.prefix + key;
  }

  get<T = any>(key: string): T | null {
    const storage = this.storage;
    if (!storage) {
      return null;
    }

    const item = storage.getItem(this.deriveKey(key));
    if (!item || item === 'null') {
      return null;
    }

    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: any): boolean {
    const storage = this.storage;
    if (!storage) {
      return false;
    }

    const serialized = value === undefined ? null : JSON.stringify(value);

    try {
      storage.setItem(this.deriveKey(key), serialized as string);
    } catch {
      return false;
    }

    this.setItemsSubject.next({ key, newvalue: serialized, storageType: 'localStorage' });
    return true;
  }

  remove(...keys: string[]): boolean {
    const storage = this.storage;
    if (!storage) {
      return false;
    }

    let result = true;
    for (const key of keys) {
      try {
        storage.removeItem(this.deriveKey(key));
      } catch {
        result = false;
      }
    }
    return result;
  }

  keys(): string[] {
    const storage = this.storage;
    if (!storage) {
      return [];
    }

    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}
