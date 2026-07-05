import {
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { EntryType } from '../../shared/types';

interface WizardStep {
  id: number;
  label: string;
  description: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, IconComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registry = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentStep = signal(1);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly submittedId = signal<string | null>(null);

  readonly steps: WizardStep[] = [
    { id: 1, label: 'Type', description: 'Choose entry type' },
    { id: 2, label: 'Identity', description: 'Name & publisher' },
    { id: 3, label: 'Details', description: 'Type-specific info' },
    { id: 4, label: 'Governance', description: 'Visibility & access' },
    { id: 5, label: 'Review', description: 'Confirm & submit' },
  ];

  readonly typeOptions: Array<{ value: EntryType; label: string; icon: string; desc: string }> = [
    { value: 'server', label: 'MCP Server', icon: 'server', desc: 'Expose tools over stdio, HTTP, or SSE' },
    { value: 'tool', label: 'Tool', icon: 'tool', desc: 'Individual callable function in a server' },
    { value: 'skill', label: 'Skill', icon: 'skill', desc: 'SKILL.md-defined reusable behavior' },
    { value: 'agent', label: 'Agent', icon: 'agent', desc: 'Composed model + servers + skills' },
    { value: 'api', label: 'API', icon: 'api', desc: 'REST or GraphQL endpoint' },
  ];

  readonly modelOptions = [
    'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5',
    'gpt-4o', 'gpt-4o-mini', 'gemini-2.0-flash', 'gemini-1.5-pro',
  ];

  readonly transportOptions = [
    { id: 'http', t: 'HTTP', d: 'Streamable HTTP endpoint' },
    { id: 'sse', t: 'SSE', d: 'Server-sent events' },
    { id: 'stdio', t: 'stdio', d: 'Local subprocess' },
  ];

  form!: FormGroup;

  get selectedType(): EntryType {
    return this.form.get('type')?.value as EntryType;
  }

  get isServer(): boolean { return this.selectedType === 'server'; }
  get isTool(): boolean { return this.selectedType === 'tool'; }
  get isSkill(): boolean { return this.selectedType === 'skill'; }
  get isAgent(): boolean { return this.selectedType === 'agent'; }
  get isApi(): boolean { return this.selectedType === 'api'; }

  get params(): FormArray {
    return this.form.get('params') as FormArray;
  }

  get slugValue(): string {
    const name = (this.form.get('name')?.value as string) ?? '';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      type: ['server', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      publisher: ['', [Validators.required, Validators.minLength(2)]],
      summary: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(280)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      version: ['1.0.0'],
      categories: [''],
      transports: [['stdio']],
      auth: ['none'],
      parentServer: [''],
      params: this.fb.array([]),
      returns: ['string'],
      triggers: [''],
      reaches: [''],
      model: ['claude-sonnet-4-5'],
      autonomy: ['low'],
      servers: [''],
      skills: [''],
      style: ['REST'],
      endpoint: [''],
      wrappedBy: [''],
      source: [''],
      license: ['MIT'],
      sensitivity: ['public', [Validators.required]],
      readOnly: [false],
      approvalRequired: [false],
    });
  }

  selectType(type: EntryType): void {
    this.form.patchValue({ type });
  }

  /** Collections are authored in their own flow rather than the entry wizard. */
  createCollection(): void {
    void this.router.navigate(['/collections/new']);
  }

  /** Form controls that gate advancing past each step. */
  private fieldsForStep(step: number): string[] {
    switch (step) {
      case 2: return ['name', 'publisher', 'summary', 'description'];
      case 4: return ['sensitivity'];
      default: return [];
    }
  }

  isStepValid(step: number): boolean {
    // Step 3 is type-specific; validate by value since these controls have no
    // always-on validators (they'd otherwise break unrelated entry types).
    if (step === 3) {
      if (this.isServer) {
        return ((this.form.get('transports')?.value ?? []) as string[]).length > 0;
      }
      if (this.isTool) return !!(this.form.get('parentServer')?.value as string)?.trim();
      if (this.isApi) return !!(this.form.get('style')?.value as string);
      return true;
    }
    return this.fieldsForStep(step).every(f => this.form.get(f)?.valid ?? true);
  }

  nextStep(): void {
    const step = this.currentStep();
    if (!this.isStepValid(step)) {
      // Surface the errors for the incomplete fields and stay on this step.
      this.fieldsForStep(step).forEach(f => this.form.get(f)?.markAsTouched());
      return;
    }
    if (step < 5) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  addParam(): void {
    this.params.push(this.fb.group({
      name: ['', Validators.required],
      type: ['string', Validators.required],
      description: [''],
      required: [false],
    }));
  }

  removeParam(index: number): void {
    this.params.removeAt(index);
  }

  toggleTransport(t: string): void {
    const current = (this.form.get('transports')?.value ?? []) as string[];
    const idx = current.indexOf(t);
    if (idx >= 0) {
      this.form.patchValue({ transports: current.filter((_, i) => i !== idx) });
    } else {
      this.form.patchValue({ transports: [...current, t] });
    }
  }

  hasTransport(t: string): boolean {
    return ((this.form.get('transports')?.value ?? []) as string[]).includes(t);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.value as Record<string, unknown>;
    const categories = typeof raw['categories'] === 'string'
      ? (raw['categories'] as string).split(',').map(c => c.trim()).filter(Boolean)
      : [];

    const entry: Record<string, unknown> = {
      type: raw['type'],
      name: raw['name'],
      slug: this.slugValue,
      publisher: raw['publisher'],
      summary: raw['summary'],
      description: raw['description'],
      version: raw['version'] || undefined,
      categories,
      sensitivity: raw['sensitivity'],
    };

    if (this.isServer) {
      entry['transports'] = raw['transports'];
      entry['auth'] = raw['auth'];
      entry['source'] = raw['source'];
      entry['license'] = raw['license'];
    }
    if (this.isTool) {
      entry['parentServer'] = raw['parentServer'];
      entry['params'] = raw['params'];
      entry['returns'] = raw['returns'];
      entry['readOnly'] = raw['readOnly'];
    }
    if (this.isSkill) {
      entry['triggers'] = typeof raw['triggers'] === 'string'
        ? (raw['triggers'] as string).split(',').map(t => t.trim()).filter(Boolean) : [];
      entry['reaches'] = typeof raw['reaches'] === 'string'
        ? (raw['reaches'] as string).split(',').map(r => r.trim()).filter(Boolean) : [];
    }
    if (this.isAgent) {
      entry['model'] = raw['model'];
      entry['autonomy'] = raw['autonomy'];
      entry['servers'] = typeof raw['servers'] === 'string'
        ? (raw['servers'] as string).split(',').map(s => s.trim()).filter(Boolean) : [];
      entry['skills'] = typeof raw['skills'] === 'string'
        ? (raw['skills'] as string).split(',').map(s => s.trim()).filter(Boolean) : [];
    }
    if (this.isApi) {
      entry['style'] = raw['style'];
      entry['endpoint'] = raw['endpoint'];
      entry['wrappedBy'] = raw['wrappedBy'];
    }

    this.registry.submitEntry(entry as Parameters<typeof this.registry.submitEntry>[0])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.submittedId.set(result.id);
          this.submitted.set(true);
          this.submitting.set(false);
        },
        error: () => {
          this.error.set('Submission failed. Please try again.');
          this.submitting.set(false);
        },
      });
  }

  startOver(): void {
    this.submitted.set(false);
    this.submittedId.set(null);
    this.currentStep.set(1);
    void this.router.navigate(['/']);
  }
}
