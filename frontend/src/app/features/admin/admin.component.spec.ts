import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminComponent } from './admin.component';
import { RegistryService } from '../../core/services/registry.service';
import { PendingEntry } from '../../shared/types';

function fakePending(): PendingEntry {
  return {
    id: 'p1',
    entry: {
      id: 'e1',
      type: 'skill',
      name: 'Test Skill',
      slug: 'test-skill',
      publisher: 'acme',
      verified: false,
      summary: 'summary',
      description: 'description',
      installs: 0,
      sensitivity: 'public',
      categories: ['Developer Tools'],
      createdAt: '',
      updatedAt: '',
    },
    submittedBy: 'u1',
    submittedAt: '',
    status: 'pending',
    risk: 'low',
    flags: [],
  };
}

describe('AdminComponent', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let registry: jasmine.SpyObj<RegistryService>;

  beforeEach(async () => {
    registry = jasmine.createSpyObj('RegistryService', [
      'getStats',
      'getPendingStats',
      'getPending',
      'approvePending',
      'rejectPending',
    ]);
    registry.getStats.and.returnValue(
      of({
        totalEntries: 1,
        totalByType: { server: 0, tool: 0, skill: 1, agent: 0, api: 0 },
        totalInstalls: 0,
        verifiedCount: 0,
      }),
    );
    registry.getPendingStats.and.returnValue(
      of({ pendingCount: 1, approvedCount: 0, approvedThisWeek: 0, avgReviewTimeMinutes: 5, highRiskPending: 0 }),
    );
    registry.getPending.and.returnValue(of({ hits: [fakePending()], total: 1, page: 0, size: 20 }));

    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [provideRouter([]), { provide: RegistryService, useValue: registry }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
  });

  it('shows stats error callout when stats fail to load', () => {
    registry.getStats.and.returnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.loadStats();
    fixture.detectChanges();

    expect(fixture.componentInstance.statsError()).toContain('registry statistics');
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });

  it('validates reject dialog minimum reason length', () => {
    const entry = fakePending();
    fixture.componentInstance.reject(entry);
    fixture.componentInstance.rejectReason.set('short');
    fixture.componentInstance.confirmRejectDialog();
    fixture.detectChanges();

    expect(fixture.componentInstance.rejectError()).toContain('10 characters');
    expect(registry.rejectPending).not.toHaveBeenCalled();
  });

  it('submits reject when reason is long enough', () => {
    registry.rejectPending.and.returnValue(of(undefined));
    const entry = fakePending();
    fixture.componentInstance.reject(entry);
    fixture.componentInstance.rejectReason.set('This submission does not meet our quality bar.');
    fixture.componentInstance.confirmRejectDialog();

    expect(registry.rejectPending).toHaveBeenCalled();
  });
});
