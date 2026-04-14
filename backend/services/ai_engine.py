import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans

class AIAgent:
    def __init__(self):
        self.revenue_model = LinearRegression()
        self.clustering_model = KMeans(n_clusters=3)

    def predict_revenue(self, historical_data):
        """
        historical_data: List of revenue values
        Returns: Forecasted revenue for next period
        """
        if len(historical_data) < 2:
            return historical_data[-1] * 1.05 if historical_data else 0
        
        X = np.array(range(len(historical_data))).reshape(-1, 1)
        y = np.array(historical_data)
        self.revenue_model.fit(X, y)
        
        next_step = np.array([[len(historical_data)]])
        prediction = self.revenue_model.predict(next_step)
        return float(prediction[0])

    def segment_customers(self, customer_features):
        """
        customer_features: DataFrame with columns ['spend', 'frequency', 'age']
        Returns: Cluster labels
        """
        if customer_features.empty:
            return []
        return self.clustering_model.fit_predict(customer_features).tolist()

class RLAgent:
    def __init__(self):
        self.learning_rate = 0.1
        self.discount_factor = 0.9
        self.actions = ['Increase Rent', 'Decrease Rent', 'No Change']
        self.q_table = {} # State-Action pair mapping

    def _get_state_key(self, state):
        return str(state)

    def get_optimal_action(self, state):
        state_key = self._get_state_key(state)
        if state_key not in self.q_table:
            self.q_table[state_key] = np.zeros(len(self.actions))
        
        # Epsilon-greedy selection
        if np.random.random() < 0.1: # Exploration
            return np.random.choice(self.actions)
        
        action_idx = np.argmax(self.q_table[state_key])
        return self.actions[action_idx]

    def update_policy(self, state, action, reward, next_state):
        state_key = self._get_state_key(state)
        next_state_key = self._get_state_key(next_state)
        
        if state_key not in self.q_table: self.q_table[state_key] = np.zeros(len(self.actions))
        if next_state_key not in self.q_table: self.q_table[next_state_key] = np.zeros(len(self.actions))
        
        action_idx = self.actions.index(action)
        best_next_action = np.max(self.q_table[next_state_key])
        
        # Q-learning formula
        self.q_table[state_key][action_idx] += self.learning_rate * (
            reward + self.discount_factor * best_next_action - self.q_table[state_key][action_idx]
        )

# Singleton instances
ai_engine = AIAgent()
rl_engine = RLAgent()
