import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Main application component for Graphify
 *
 * This component serves as the root container for the application
 * and includes the main layout structure with header, content area, and footer.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Graphify';
}
