// SPDX-License-Identifier: MIT
import type { TFile } from 'obsidian';
import { PropertyIndex } from './index';
import { parseInlineProperties } from './inline-properties';

interface Request { file: TFile; stamp: string; epoch: number }

/** Bounded reads with latest-request guards; no writes or Dataview dependency. */
export class InlineIndex {
  index = new PropertyIndex();
  enabled = false;
  readonly failures = new Set<string>();
  private epoch = 0;
  private active = 0;
  private requests = new Map<string, Request>();
  private queue = new Map<string, Request>();
  private stamps = new Map<string, string>();
  constructor(private read: (file: TFile) => Promise<string>, private included: (path: string) => boolean, private changed: () => void) {}
  get pending(): number { return this.requests.size; }
  private stamp(file: TFile): string { return `${file.stat?.mtime}:${file.stat?.size}`; }
  setEnabled(enabled: boolean, notify = true): void {
    this.epoch++; this.enabled = enabled;
    this.requests.clear(); this.queue.clear(); this.stamps.clear(); this.failures.clear(); this.index = new PropertyIndex();
    if (notify) this.changed();
  }
  sync(files: readonly TFile[], force = false): void {
    if (!this.enabled) return;
    const included = new Set(files.filter(file => this.included(file.path)).map(file => file.path));
    for (const path of new Set([...this.stamps.keys(), ...this.requests.keys(), ...this.failures])) if (!included.has(path)) this.remove(path);
    for (const file of files) if (included.has(file.path) && (force || this.stamps.get(file.path) !== this.stamp(file))) this.update(file);
  }
  update(file: TFile, content?: string): void {
    const path = file.path;
    if (!this.enabled) return;
    if (file.extension !== 'md' || !this.included(path)) { this.remove(path); return; }
    if (content !== undefined) {
      this.requests.delete(path); this.queue.delete(path); this.failures.delete(path);
      this.index.update(path, parseInlineProperties(content)); this.stamps.set(path, this.stamp(file)); this.changed(); return;
    }
    const request = { file, stamp: this.stamp(file), epoch: this.epoch };
    this.requests.set(path, request); this.queue.set(path, request); this.pump(); this.changed();
  }
  remove(path: string): void {
    this.requests.delete(path); this.queue.delete(path); this.stamps.delete(path); this.failures.delete(path); this.index.remove(path); this.changed();
  }
  private pump(): void {
    while (this.active < 4 && this.queue.size) {
      const [path, request] = this.queue.entries().next().value!;
      this.queue.delete(path); this.active++;
      void this.load(path, request);
    }
  }
  private async load(path: string, request: Request): Promise<void> {
    const current = () => this.enabled && request.epoch === this.epoch && this.requests.get(path) === request && request.file.path === path && this.included(path);
    try {
      const content = await this.read(request.file);
      if (current()) {
        this.index.update(path, parseInlineProperties(content)); this.stamps.set(path, request.stamp); this.failures.delete(path);
      }
    } catch {
      if (current()) { this.index.remove(path); this.failures.add(path); }
    } finally {
      if (this.requests.get(path) === request) this.requests.delete(path);
      this.active--; this.pump(); if (this.enabled) this.changed();
    }
  }
}
