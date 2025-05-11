import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TicketsChartProps {
  data: { date: string; count: number }[];
}

export const TicketsChart: React.FC<TicketsChartProps> = ({ data }) => {
  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Tickets SAP (7 derniers jours)',
        data: data.map(d => d.count),
        fill: true,
        backgroundColor: 'rgba(250, 204, 21, 0.15)', // yellow-400/15
        borderColor: '#facc15', // yellow-400
        pointBackgroundColor: '#facc15',
        tension: 0.4,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#facc15',
        bodyColor: '#fff',
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#facc15', font: { weight: 'bold' } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#fff' },
      },
    },
  };
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20 animate-fade-in-up">
      <Line data={chartData} options={options} height={120} />
    </div>
  );
}; 