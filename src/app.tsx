import { AppProvider, useAppStore } from '@/store';
import PaymentModal from '@/components/PaymentModal';
import './app.scss';

function AppContent(props) {
  const { paymentInfo, showPayment, closePayment, confirmPay } = useAppStore();
  return (
    <>
      {props.children}
      <PaymentModal
        visible={showPayment}
        orderInfo={paymentInfo}
        onClose={closePayment}
        onPay={(method) => confirmPay(method)}
      />
    </>
  );
}

function App(props) {
  return (
    <AppProvider>
      <AppContent>{props.children}</AppContent>
    </AppProvider>
  );
}

export default App;
