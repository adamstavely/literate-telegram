import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CollectionCreateComponent } from './collection-create.component';
import { RegistryService } from '../../core/services/registry.service';

describe('CollectionCreateComponent', () => {
  let fixture: ComponentFixture<CollectionCreateComponent>;
  let registry: jasmine.SpyObj<RegistryService>;

  beforeEach(async () => {
    registry = jasmine.createSpyObj('RegistryService', ['createCollection', 'searchEntries']);
    registry.searchEntries.and.returnValue(
      of({
        hits: [{ id: '1', type: 'server', slug: 'stripe', name: 'Stripe' } as never],
        total: 1,
        page: 0,
        size: 500,
      }),
    );
    registry.createCollection.and.returnValue(
      of({ id: 'col-1', title: 'T', desc: 'd', blurb: 'b', icon: 'box', curator: 'c', accent: '#000', members: [], entries: [], count: 1, installs: 0, sensitivity: 'public' }),
    );

    await TestBed.configureTestingModule({
      imports: [CollectionCreateComponent],
      providers: [
        provideRouter([]),
        { provide: RegistryService, useValue: registry },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionCreateComponent);
    fixture.detectChanges();
  });

  it('disables submit until required fields are filled', () => {
    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.title.set('My Stack');
    fixture.componentInstance.summary.set('A useful stack');
    fixture.componentInstance.members.set('stripe');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('submits members with resolved entry kinds', () => {
    fixture.componentInstance.title.set('My Stack');
    fixture.componentInstance.summary.set('A useful stack');
    fixture.componentInstance.members.set('stripe');
    fixture.componentInstance.submit();

    expect(registry.createCollection).toHaveBeenCalled();
    const payload = registry.createCollection.calls.mostRecent().args[0];
    expect(payload.members).toEqual([{ kind: 'server', id: 'stripe' }]);
  });

  it('shows error callout when create fails', () => {
    registry.createCollection.and.returnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.title.set('My Stack');
    fixture.componentInstance.summary.set('A useful stack');
    fixture.componentInstance.members.set('stripe');
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toContain('Could not create');
  });

  it('back link uses routerLink for keyboard navigation', () => {
    const link = fixture.nativeElement.querySelector('a.inline-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/collections');
  });
});
