
import React from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface Transaction {
  id: string;
  studentName: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Failed';
  sessionSubject: string;
}

const TEACHER_TRANSACTIONS: Transaction[] = [
  { id: 'tr1', studentName: 'Aayush Sharma', amount: 1200, date: '2024-03-01', status: 'Paid', sessionSubject: 'Quantum Physics' },
  { id: 'tr2', studentName: 'Bipul Chhetri', amount: 850, date: '2024-03-02', status: 'Paid', sessionSubject: 'Economics' },
  { id: 'tr3', studentName: 'Sita Ram', amount: 1500, date: '2024-03-03', status: 'Pending', sessionSubject: 'History of Art' },
  { id: 'tr4', studentName: 'Gita Kumari', amount: 950, date: '2024-03-04', status: 'Paid', sessionSubject: 'Mandarin' },
  { id: 'tr5', studentName: 'Ram Prasad', amount: 1100, date: '2024-03-05', status: 'Pending', sessionSubject: 'Computer Science' },
];

const TeacherEarnings: React.FC = () => {
  const earned = TEACHER_TRANSACTIONS.filter(t => t.status === 'Paid').reduce((acc, t) => acc + t.amount, 0);
  const pending = TEACHER_TRANSACTIONS.filter(t => t.status === 'Pending').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Earnings Overview 💰</h1>
        <p className="text-muted-foreground">Track your income and pending payouts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-8 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-4">
            <DollarSign size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Total Earned</p>
          <h3 className="text-3xl font-bold">NPR {earned.toLocaleString()}</h3>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full w-fit">
            <TrendingUp size={12} />
            <span>+12% from last month</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-4">
            <Clock size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Pending Payout</p>
          <h3 className="text-3xl font-bold">NPR {pending.toLocaleString()}</h3>
          <p className="mt-4 text-xs text-muted-foreground">Estimated payout: March 15, 2024</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
            <CheckCircle size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Next Payout</p>
          <h3 className="text-3xl font-bold">NPR {earned.toLocaleString()}</h3>
          <button className="mt-4 w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:bg-opacity-90 transition-colors">
            Withdraw Now
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-6">Recent Transactions</h2>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-bottom border-border">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TEACHER_TRANSACTIONS.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                          {transaction.studentName.charAt(0)}
                        </div>
                        <span className="font-medium">{transaction.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{transaction.sessionSubject}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{transaction.date}</td>
                    <td className="px-6 py-4 font-bold">NPR {transaction.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        transaction.status === 'Paid' 
                          ? 'bg-green-100 text-green-700' 
                          : transaction.status === 'Pending'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TeacherEarnings;
