import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EndpointCardComponent } from './endpoint-card.component';
import { RegistryService } from '../../../core/services/registry.service';
import { Api, ApiEndpoint, ProxyResponse } from '../../types';

const api: Api = {
  id: '1',
  type: 'api',
  name: 'Stripe API',
  slug: 'stripe',
  publisher: 'stripe.com',
  verified: true,
  summary: 'Payments',
  description: 'Payments API',
  installs: 0,
  sensitivity: 'public',
  categories: [],
  createdAt: '',
  updatedAt: '',
  style: 'REST',
  baseUrl: 'https://api.stripe.com',
  endpoints: [],
};

const ep: ApiEndpoint = { method: 'GET', path: '/v1/charges', summary: 'List charges' };

const proxyResult: ProxyResponse = {
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"ok":true}',
  truncated: false,
  ms: 12,
};

describe('EndpointCardComponent', () => {
  let fixture: ComponentFixture<EndpointCardComponent>;
  let registryStub: { proxyTry: jasmine.Spy };

  beforeEach(async () => {
    registryStub = { proxyTry: jasmine.createSpy('proxyTry').and.returnValue(of(proxyResult)) };
    await TestBed.configureTestingModule({
      imports: [EndpointCardComponent],
      providers: [provideRouter([]), { provide: RegistryService, useValue: registryStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(EndpointCardComponent);
    fixture.componentInstance.api = api;
    fixture.componentInstance.ep = ep;
    fixture.detectChanges();
  });

  it('toggles open state and sets aria-expanded', () => {
    const btn = fixture.nativeElement.querySelector('.ep-toggle') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toContain('ep-panel-GET');

    btn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('executes a real proxied request and maps the upstream response', () => {
    fixture.componentInstance.toggleOpen();
    fixture.componentInstance.toggleTry();
    fixture.detectChanges();

    fixture.componentInstance.execute();

    expect(registryStub.proxyTry).toHaveBeenCalledTimes(1);
    const arg = registryStub.proxyTry.calls.mostRecent().args[0] as { entryId: string; method: string };
    expect(arg.entryId).toBe('1');
    expect(arg.method).toBe('GET');
    expect(fixture.componentInstance.resp()?.code).toBe('200');
    expect(fixture.componentInstance.resp()?.body).toContain('ok');
  });

  it('forwards an entered credential as a Bearer Authorization header', () => {
    fixture.componentInstance.toggleOpen();
    fixture.componentInstance.toggleTry();
    fixture.componentInstance.authToken.set('sk_live_123');
    fixture.componentInstance.execute();

    const arg = registryStub.proxyTry.calls.mostRecent().args[0] as { headers?: Record<string, string> };
    expect(arg.headers?.['Authorization']).toBe('Bearer sk_live_123');
  });

  it('short-circuits without calling the proxy when a required param is missing', () => {
    const f = TestBed.createComponent(EndpointCardComponent);
    f.componentInstance.api = api;
    f.componentInstance.ep = { method: 'GET', path: '/things/:widget' };
    f.detectChanges();
    registryStub.proxyTry.calls.reset();

    f.componentInstance.toggleOpen();
    f.componentInstance.toggleTry();
    f.componentInstance.execute();

    expect(registryStub.proxyTry).not.toHaveBeenCalled();
    expect(f.componentInstance.resp()?.label).toBe('Missing field');
  });
});
