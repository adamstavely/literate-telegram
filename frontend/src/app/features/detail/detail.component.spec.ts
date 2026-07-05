import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DetailComponent } from './detail.component';
import { RegistryService } from '../../core/services/registry.service';
import { Server } from '../../shared/types';

function fakeServer(slug: string): Server {
  return {
    id: slug,
    type: 'server',
    name: slug,
    slug,
    publisher: 'acme',
    verified: true,
    summary: '',
    description: '',
    installs: 0,
    sensitivity: 'public',
    categories: [],
    createdAt: '',
    updatedAt: '',
    transports: ['http'],
    auth: 'None',
    tools: [],
    clients: [],
    license: 'MIT',
    source: '',
    rating: 0,
  } as Server;
}

describe('DetailComponent route reuse', () => {
  let getEntry: jasmine.Spy;

  beforeEach(() => {
    getEntry = jasmine
      .createSpy('getEntry')
      .and.callFake((_type: string, slug: string) => of(fakeServer(slug)));

    TestBed.configureTestingModule({
      imports: [DetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: RegistryService,
          useValue: {
            getEntry,
            searchEntries: () => of({ hits: [], total: 0, page: 0, size: 0 }),
          },
        },
      ],
    });
  });

  it('re-fetches when the slug input changes on the reused instance', () => {
    const fixture = TestBed.createComponent(DetailComponent);
    const comp = fixture.componentInstance;

    comp.type = 'server';
    comp.slug = 'alpha';
    comp.ngOnChanges({ slug: new SimpleChange(undefined, 'alpha', true) });

    expect(getEntry).toHaveBeenCalledWith('server', 'alpha');
    expect(comp.entry()?.slug).toBe('alpha');

    comp.slug = 'beta';
    comp.ngOnChanges({ slug: new SimpleChange('alpha', 'beta', false) });

    expect(getEntry).toHaveBeenCalledWith('server', 'beta');
    expect(getEntry).toHaveBeenCalledTimes(2);
    expect(comp.entry()?.slug).toBe('beta');
  });
});
