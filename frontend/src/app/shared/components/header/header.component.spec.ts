import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../../core/services/auth.service';
import { RegistryService } from '../../../core/services/registry.service';

describe('HeaderComponent notifications', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let registry: jasmine.SpyObj<RegistryService>;
  const currentUser$ = new BehaviorSubject({
    sub: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['admin'],
  });

  beforeEach(async () => {
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
});
