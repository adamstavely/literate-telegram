import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { BrowseComponent } from './browse.component';
import { RegistryService } from '../../core/services/registry.service';

describe('BrowseComponent', () => {
  let fixture: ComponentFixture<BrowseComponent>;
  let registry: jasmine.SpyObj<RegistryService>;
  const queryParams$ = new Subject<Record<string, string>>();

  beforeEach(async () => {
    registry = jasmine.createSpyObj('RegistryService', [
      'getStats',
      'getCollections',
      'searchEntries',
    ]);
    registry.getStats.and.returnValue(
      of({
        totalEntries: 0,
        totalByType: { server: 0, tool: 0, skill: 0, agent: 0, api: 0 },
        totalInstalls: 0,
        verifiedCount: 0,
      }),
    );
    registry.getCollections.and.returnValue(of([]));
    registry.searchEntries.and.returnValue(of({ hits: [], total: 0, page: 0, size: 12 }));

    await TestBed.configureTestingModule({
      imports: [BrowseComponent],
      providers: [
        provideRouter([]),
        { provide: RegistryService, useValue: registry },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowseComponent);
    fixture.detectChanges();
    queryParams$.next({});
    fixture.detectChanges();
  });

  it('surfaces collections load failure with retry', () => {
    registry.getCollections.and.returnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.loadCollections();
    fixture.detectChanges();

    expect(fixture.componentInstance.collectionsError()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });

  it('surfaces stats load failure with retry', () => {
    registry.getStats.and.returnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.loadStats();
    fixture.detectChanges();

    expect(fixture.componentInstance.statsError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });
});
