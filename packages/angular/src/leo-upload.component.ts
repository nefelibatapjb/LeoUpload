import { CommonModule } from '@angular/common';
import {
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import type {
  AfterContentInit,
  OnDestroy,
} from '@angular/core';
import type {
  UploadConfig,
  UploadError,
  UploadResult,
} from '@leoupload/core';
import { LeoUploadService } from './leo-upload.service';

/**
 * Standalone Angular component for LeoUpload.
 *
 * Renders a default drop zone + progress UI, or a custom template declared
 * with `#ui` (template context: `$implicit` = the LeoUploadService, plus
 * `status`, `progress`, `fileName`, `start`, `pause`, `resume`, `cancel`,
 * `selectFile`).
 *
 * ```html
 * <leo-upload [config]="config" (leoComplete)="onDone($event)">
 *   <ng-template #ui let-svc let-status="status" let-progress="progress">
 *     <progress [value]="progress" max="100"></progress>
 *     <button (click)="svc.pause()">Pause</button>
 *   </ng-template>
 * </leo-upload>
 * ```
 */
@Component({
  selector: 'leo-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <input #fileInput type="file" [hidden]="true" (change)="onFileChange($event)" />

    <div
      class="leoupload__zone"
      (click)="selectFile()"
      (dragover)="$event.preventDefault()"
      (drop)="onDrop($event)"
    >
      <ng-content select="[leoTrigger]"></ng-content>
      <button type="button" class="leoupload__btn" (click)="selectFile()">Select File</button>
    </div>

    <ng-container *ngIf="service">
      <ng-container *ngIf="uiTemplate; else defaultUi">
        <ng-container
          *ngTemplateOutlet="
            uiTemplate;
            context: uiContext
          "
        ></ng-container>
      </ng-container>

      <ng-template #defaultUi>
        <div class="leoupload__info">
          <progress [value]="service.progress()" max="100"></progress>
          <span class="leoupload__status">
            {{ service.fileName() || service.status() }}
            {{ service.status() === 'uploading' ? '— ' + service.progress() + '%' : '' }}
          </span>
          <div class="leoupload__actions">
            <button *ngIf="service.status() === 'uploading'" (click)="service.pause()">
              Pause
            </button>
            <button *ngIf="service.status() === 'paused'" (click)="service.resume()">
              Resume
            </button>
            <button
              *ngIf="service.status() === 'uploading' || service.status() === 'paused'"
              (click)="service.cancel()"
            >
              Cancel
            </button>
          </div>
          <div class="leoupload__error" *ngIf="service.error() as err">
            {{ err.message }}
          </div>
        </div>
      </ng-template>
    </ng-container>

    <style>
      :host {
        display: block;
        font-family: system-ui, sans-serif;
      }
      .leoupload__zone {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.2s;
      }
      .leoupload__zone:hover {
        border-color: #4a90d9;
      }
      .leoupload__info {
        margin-top: 1rem;
      }
      .leoupload__progress {
        width: 100%;
        height: 8px;
        border-radius: 4px;
      }
      .leoupload__status {
        display: block;
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: #666;
      }
      .leoupload__actions {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.5rem;
      }
      .leoupload__actions button {
        padding: 0.4rem 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .leoupload__error {
        margin-top: 0.5rem;
        color: #d32f2f;
        font-size: 0.875rem;
      }
    </style>
  `,
})
export class LeoUploadComponent implements AfterContentInit, OnDestroy {
  @Input() config: Partial<UploadConfig> = {};
  @Output() leoComplete = new EventEmitter<UploadResult>();
  @Output() leoError = new EventEmitter<UploadError>();

  /** Custom UI template (declared as `<ng-template #ui>` inside the component) */
  @ContentChild('ui', { static: false }) uiTemplate?: TemplateRef<unknown>;

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  service?: LeoUploadService;

  private unsubs: Array<() => void> = [];

  ngAfterContentInit(): void {
    this.service = new LeoUploadService(this.config);
    this.unsubs.push(
      this.service.on('complete', (r) => this.leoComplete.emit(r)),
      this.service.on('error', (e) => this.leoError.emit(e)),
    );
  }

  ngOnDestroy(): void {
    for (const unsub of this.unsubs) unsub();
    this.service?.destroy();
  }

  get uiContext(): Record<string, unknown> {
    const svc = this.service!;
    return {
      $implicit: svc,
      get status() {
        return svc.status();
      },
      get progress() {
        return svc.progress();
      },
      get fileName() {
        return svc.fileName();
      },
      get error() {
        return svc.error();
      },
      start: (file: File) => svc.start(file),
      pause: () => svc.pause(),
      resume: () => svc.resume(),
      cancel: () => svc.cancel(),
      selectFile: () => this.selectFile(),
    };
  }

  selectFile(): void {
    const el = this.fileInputRef?.nativeElement;
    if (el) {
      el.value = '';
      el.click();
    }
  }

  onFileChange(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.service?.start(file);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.service?.start(file);
  }
}
