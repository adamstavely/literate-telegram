import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../../core/services/auth.service';
import { RegistryService } from '../../../core/services/registry.service';

describe('HeaderComponent notifications', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let registry: jasmine.SpyObj<RegistryService>;
  let focusTrapFactory: jasmine.SpyObj<FocusTrapFactory>;
  let trap: jasmine.SpyObj<FocusTrap>;
  const currentUser$ = new BehaviorSubject({
    sub: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['admin'],
  });

  beforeEach(async () => {
    trap = jasmine.createSpyObj('FocusTrap', ['destroy']);
    (trap as FocusTrap & { focusInitialElementWhenReady: jasmine.Spy }).focusInitialElementWhenReady =
      jasmine.createSpy('focusInitialElementWhenReady').and.returnValue(Promise.resolve());
    focusTrapFactory = jasmine.createSpyObj('FocusTrapFactory', ['create']);
    focusTrapFactory.create.and.returnValue(trap);

    registry = jasmine.createSpyObj('RegistryService', [
      'getNotifications',
      'markAllRead',
      'markNotificationRead',
    ]);
    registry.getNotifications.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: FocusTrapFactory, useValue: focusTrapFactory },
        {
          provide: AuthService,
          useValue: {
            currentUser$,
            isAuthenticated: () => true,
            isAdmin: () => true,
            login: () => undefined,
            logout: () => undefined,
          },
        },
        { provide: RegistryService, useValue: registry },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
  });

  it('shows notification error when fetch fails', () => {
    registry.getNotifications.and.returnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.toggleNotifications();
    fixture.detectChanges();

    expect(fixture.componentInstance.notificationsError()).toContain('Could not load');
  });

  it('closes notifications on Escape', () => {
    fixture.componentInstance.toggleNotifications();
    fixture.detectChanges();
    expect(fixture.componentInstance.notificationsOpen()).toBe(true);

    fixture.componentInstance.onGlobalKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.notificationsOpen()).toBe(false);
  });

  it('notification tabs expose tablist semantics', fakeAsync(() => {
    fixture.componentInstance.toggleNotifications();
    tick();
    fixture.detectChanges();
    const tablist = fixture.nativeElement.querySelector('.notif-tabs[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  }));
});
