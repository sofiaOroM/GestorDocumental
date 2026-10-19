import { Pipe, PipeTransform } from '@angular/core';
import { fmtBytes } from './util';

@Pipe({ name: 'bytes' })
export class Bytes implements PipeTransform {
  transform(v: number | undefined | null): string { return fmtBytes(v); }
}
