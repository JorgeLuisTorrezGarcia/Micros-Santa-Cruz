import { AppShell } from './AppShell.tsx';
import { useAppController } from './useAppController.ts';

export default function App() {
  const controller = useAppController();
  return <AppShell controller={controller} />;
}
