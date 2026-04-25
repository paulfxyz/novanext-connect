import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/home";
import AdminPage from "./pages/admin";
import AdminLoginPage from "./pages/admin-login";
import ContactPage from "./pages/contact";
import NotFound from "./pages/not-found";
import { Component, type ReactNode } from "react";

// Global error boundary — catches render crashes and shows a recovery UI
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '20px',
          background: '#080818', padding: '32px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem' }}>⚡</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: 'white', textTransform: 'uppercase' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', maxWidth: '320px' }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '/'; }}
            style={{ padding: '12px 28px', background: '#2020C8', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            ← Back to Directory
          </button>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/contact/:slug" component={ContactPage} />
            <Route path="/admin/login" component={AdminLoginPage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </Router>
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
