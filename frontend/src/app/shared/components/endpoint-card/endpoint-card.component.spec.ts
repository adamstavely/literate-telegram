import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EndpointCardComponent } from './endpoint-card.component';
import { Api, ApiEndpoint } from '../../types';

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

describe('EndpointCardComponent', () => {
  let fixture: ComponentFixture<EndpointCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EndpointCardComponent],
      providers: [provideRouter([])],
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

  it('returns 400 mock response when required param is missing', () => {
    fixture.componentInstance.toggleOpen();
    fixture.componentInstance.toggleTry();
    fixture.detectChanges();

    fixture.componentInstance.execute();
    fixture.detectChanges();

    expect(fixture.componentInstance.running()).toBe(true);
  });
});
